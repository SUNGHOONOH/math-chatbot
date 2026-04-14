// ============================================================
// AHA v5 — Route 2: 실시간 소크라틱 대화 + 백그라운드 병목 감지
// ============================================================
// AGENTS.md §2, §3-1, §10 준수:
// - Dialog LLM은 오직 소크라틱 텍스트만 스트리밍 (JSON 금지)
// - after()를 사용하여 대화 로그 저장 + 병목 감지를 비동기로 처리
// - 스트리밍 도중 DB 저장을 섞어 지연을 발생시키지 않음
// ============================================================

import type { UIMessage } from 'ai';
import { TEXT_MODEL } from '@/lib/ai/models';
import { completedSessionSolutionPrompt, socraticTutorPrompt } from '@/lib/ai/prompts';
import {
  hfStreamText,
  getSlidingWindowMessages,
  getTutoringSession,
  runBottleneckDetection,
  saveDialogueLog,
} from '@/lib/ai/ai-service';
import { resumeSession } from '@/lib/services/session-service';
import { formatProblemPreviewForChat } from '@/lib/ai/problem-preview';
import { createClient } from '@/lib/supabase/server';
import { after } from 'next/server';

export const maxDuration = 60;

function extractPlainText(message: UIMessage): string {
  const content = (message as any).content;

  if (typeof content === 'string') {
    return content;
  }

  const parts = Array.isArray((message as any).parts)
    ? (message as any).parts
    : Array.isArray(content)
      ? content
      : [];

  return parts
    .map((part: any) => {
      if (typeof part === 'string') return part;
      if (part?.type === 'text' && typeof part.text === 'string') return part.text;
      return '';
    })
    .join('')
    .trim();
}

function buildKickoffMessage(problemText: string): string {
  const problemSummary = formatProblemPreviewForChat(problemText);

  return `지금 올린 문제는 ${problemSummary}를 다루는 문제예요. 어디서부터 막혔는지, 또는 어떤 방식으로 시작해 보려 했는지 먼저 말해줄래요?`;
}

function buildLanguagePolicy(latestUserMessage: string): string {
  const trimmed = latestUserMessage.trim();

  if (!trimmed) {
    return '응답 언어는 한국어를 기본값으로 유지하세요.';
  }

  const hasHangul = /[가-힣]/.test(trimmed);
  const hasCjk = /[\u4E00-\u9FFF]/.test(trimmed);

  if (hasHangul) {
    return '마지막 사용자 메시지는 한국어입니다. 반드시 한국어로만 답하고, 중국어는 절대 사용하지 마세요.';
  }

  if (hasCjk) {
    return '마지막 사용자 메시지의 언어를 따라 답하되, 사용자가 한국어로 말하지 않은 경우에만 한국어 이외 언어를 사용하세요.';
  }

  return '마지막 사용자 메시지의 언어를 최대한 따라 답하세요. 다만 사용자가 중국어로 말하지 않았다면 중국어로 답하지 마세요.';
}

export async function POST(req: Request) {
  try {
    const { messages, sessionId, kickoff = false } = await req.json();
    if (!sessionId) {
      return new Response('sessionId is required', { status: 400 });
    }

    // 1. 인증된 사용자 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const session = await getTutoringSession(sessionId);
    if (!session || session.student_id !== user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    // abandoned 세션 재진입 시 in_progress로 복원
    // (resumeSession이 다른 in_progress 세션도 함께 정리합니다)
    if (session.session_status === 'abandoned') {
      const result = await resumeSession(sessionId, { studentId: user.id });
      if (result.success) {
        session.session_status = 'in_progress';
      }
    }

    const normalizedMessages = (messages as UIMessage[])
      .map((message) => ({
        role: message.role,
        content: extractPlainText(message),
      }))
      .filter((message) => message.content.length > 0);

    const contextMessages = getSlidingWindowMessages(normalizedMessages);
    const allowFullSolution = session.session_status === 'completed';
    const latestUserMessage = [...normalizedMessages].reverse().find((message) => message.role === 'user')?.content ?? '';
    const languagePolicy = buildLanguagePolicy(latestUserMessage);

    // 2. Dialog LLM (Streaming) - 소크라틱 텍스트만 출력
    const systemPrompt = `
${allowFullSolution ? completedSessionSolutionPrompt : socraticTutorPrompt}

[CONTEXT: 학습자가 풀고 있는 문제의 원본 텍스트 및 LaTeX 데이터입니다]
${session.extracted_text}

${languagePolicy}

절대로 JSON 형식을 출력하지 마세요. 오직 학생과 대화하는 자연어 텍스트만 출력하세요.
    `.trim();

    if (kickoff) {
      const lastUserMessage = normalizedMessages[normalizedMessages.length - 1];
      if (lastUserMessage?.role === 'user') {
        await saveDialogueLog({
          sessionId,
          speaker: 'student',
          messageText: lastUserMessage.content,
        });
      }

      const assistantMessage = buildKickoffMessage(session.extracted_text);

      await saveDialogueLog({
        sessionId,
        speaker: 'ai_tutor',
        messageText: assistantMessage,
      });

      return Response.json({ message: assistantMessage });
    }

    // 3. 답변 완성을 기다리기 위한 Promise 설정
    let resolveAssistantMessage!: (text: string) => void;
    const assistantMessagePromise = new Promise<string>((resolve) => {
      resolveAssistantMessage = resolve;
    });

    const stream = await hfStreamText({
      model: TEXT_MODEL,
      system: systemPrompt,
      messages: contextMessages,
      onFinish: (text: string) => {
        resolveAssistantMessage(text);
      }
    });

    console.log('[chat/route] 스트리밍 시작:', sessionId);

    // 4. after()를 사용하여 스트리밍 완료 후 백그라운드 처리 (최상단 호출로 안정성 확보)
    after(async () => {
      try {
        const assistantMessage = await assistantMessagePromise;
        console.log('[chat/route] 스트리밍 완료, 백그라운드 분석 중:', sessionId);

        // 4-1. 대화 로그 저장 (dialogue_logs)
        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage?.role === 'user') {
          await saveDialogueLog({
            sessionId,
            speaker: 'student',
            messageText: extractPlainText(lastUserMessage as UIMessage),
          });
        }

        await saveDialogueLog({
          sessionId,
          speaker: 'ai_tutor',
          messageText: assistantMessage,
        });

        // 4-2. 병목 감지 (정규화된 메시지 사용)
        const fullMessages = [
          ...normalizedMessages,
          { role: 'assistant', content: assistantMessage },
        ];

        await runBottleneckDetection({
          sessionId,
          problemText: session.extracted_text,
          messages: fullMessages,
        });
      } catch (bgErr) {
        console.error('[chat/route] 백그라운드 작업 에러:', bgErr);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (err: any) {
    console.error('[chat/route] 치명적 에러:', err);
    return new Response(JSON.stringify({
      error: '대화 생성 중 오류가 발생했습니다.',
      details: err?.message || '알 수 없는 서버 에러'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
