// ============================================================
// AHA v5 — Route 2: 실시간 소크라틱 대화
// ============================================================
// AGENTS.md §2, §3-1, §10 준수:
// - Dialog LLM은 오직 소크라틱 텍스트만 스트리밍 (JSON 금지)
// - after()를 사용하여 대화 로그 저장과 턴별 병목 감지를 비동기로 처리
// - 스트리밍 도중 DB 저장을 섞어 지연을 발생시키지 않음
// ============================================================

import type { UIMessage } from 'ai';
import { TEXT_MODEL } from '@/lib/ai/models';
import {
  buildKickoffMessage,
  buildLanguagePolicyPrompt,
  buildTutorSystemPrompt,
} from '@/lib/ai/prompts';
import {
  hfStreamText,
  getSlidingWindowMessages,
  getTutoringSession,
  runBottleneckDetection,
  updateDialogueLogs,
} from '@/lib/ai/ai-service';
import { resumeSession } from '@/lib/services/session-service';
import { formatProblemPreviewForKickoff } from '@/lib/ai/problem-preview';
import { createClient } from '@/lib/supabase/server';
import { after } from 'next/server';

export const maxDuration = 60;

function formatDurationMs(startTime: number): string {
  return `${Date.now() - startTime}ms`;
}

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

function sanitizeAssistantOutput(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .replace(/\[PROBLEM_SOLVED\]/g, '')
    .trim();
}

export async function POST(req: Request) {
  const requestStartedAt = Date.now();
  try {
    const { messages, sessionId, kickoff = false } = await req.json();
    if (!sessionId) {
      return new Response('sessionId is required', { status: 400 });
    }

    console.log('[chat/route] 요청 시작:', {
      sessionId,
      kickoff,
      startedAt: new Date(requestStartedAt).toISOString(),
    });

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
    const languagePolicy = buildLanguagePolicyPrompt(latestUserMessage);

    // 2. Dialog LLM (Streaming) - 소크라틱 텍스트만 출력
    const systemPrompt = buildTutorSystemPrompt({
      allowFullSolution,
      problemText: session.extracted_text,
      languagePolicy,
    });

    if (kickoff) {
      const assistantMessage = buildKickoffMessage(
        formatProblemPreviewForKickoff(session.extracted_text)
      );
      const fullMessages = [
        ...normalizedMessages,
        { role: 'assistant', content: assistantMessage },
      ];

      await updateDialogueLogs({
        sessionId,
        messages: fullMessages,
      });

      console.log('[chat/route] kickoff 완료:', {
        sessionId,
        duration: formatDurationMs(requestStartedAt),
      });

      return Response.json({ message: assistantMessage });
    }

    // 3. 답변 완성을 기다리기 위한 Promise 설정
    let resolveAssistantMessage!: (text: string) => void;
    const assistantMessagePromise = new Promise<string>((resolve) => {
      resolveAssistantMessage = resolve;
    });

    const generationStartedAt = Date.now();

    const stream = await hfStreamText({
      model: TEXT_MODEL,
      system: systemPrompt,
      messages: contextMessages,
      debugTag: `session:${sessionId}`,
      onFinish: (text: string) => {
        const sanitizedText = sanitizeAssistantOutput(text);
        console.log('[chat/route] 모델 응답 완료:', {
          sessionId,
          model: TEXT_MODEL,
          generationDuration: formatDurationMs(generationStartedAt),
          totalDuration: formatDurationMs(requestStartedAt),
          responseChars: sanitizedText.length,
        });
        resolveAssistantMessage(sanitizedText);
      }
    });

    console.log('[chat/route] 스트리밍 시작:', {
      sessionId,
      model: TEXT_MODEL,
      streamReadyDuration: formatDurationMs(requestStartedAt),
    });

    // 4. after()를 사용하여 스트리밍 완료 후 백그라운드 저장/감지 처리
    after(async () => {
      try {
        const assistantMessage = await assistantMessagePromise;
        const backgroundStartedAt = Date.now();
        console.log('[chat/route] 백그라운드 저장/감지 시작:', {
          sessionId,
          elapsedBeforeBackground: formatDurationMs(requestStartedAt),
        });

        // 4-1. 대화 로그 저장
        const fullMessages = [
          ...normalizedMessages,
          { role: 'assistant', content: assistantMessage },
        ];

        await updateDialogueLogs({
          sessionId,
          messages: fullMessages,
        });

        if (session.session_status === 'in_progress') {
          await runBottleneckDetection({
            sessionId,
            problemText: session.extracted_text,
            messages: fullMessages,
          });
        }

        console.log('[chat/route] 백그라운드 저장/감지 완료:', {
          sessionId,
          backgroundDuration: formatDurationMs(backgroundStartedAt),
          totalDuration: formatDurationMs(requestStartedAt),
        });
      } catch (bgErr) {
        console.error('[chat/route] 백그라운드 작업 에러:', bgErr);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error('[chat/route] 치명적 에러:', err);
    console.error('[chat/route] 실패까지 걸린 시간:', formatDurationMs(requestStartedAt));
    return new Response(JSON.stringify({
      error: '대화 생성 중 오류가 발생했습니다.',
      details: err?.message || '알 수 없는 서버 에러'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
