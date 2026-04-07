// ============================================================
// AHA v5 — Route 2: 실시간 소크라틱 대화 + 백그라운드 병목 감지
// ============================================================
// AGENTS.md §2, §3-1, §10 준수:
// - Dialog LLM은 오직 소크라틱 텍스트만 스트리밍 (JSON 금지)
// - after()를 사용하여 대화 로그 저장 + 병목 감지를 비동기로 처리
// - 스트리밍 도중 DB 저장을 섞어 지연을 발생시키지 않음
// ============================================================

import { streamText } from 'ai';
import { huggingface } from '@ai-sdk/huggingface';
import type { ModelMessage } from 'ai';
import { TEXT_MODEL } from '@/lib/ai/models';
import { completedSessionSolutionPrompt, socraticTutorPrompt } from '@/lib/ai/prompts';
import {
  getSlidingWindowMessages,
  getTutoringSession,
  runBottleneckDetection,
  saveDialogueLog,
} from '@/lib/ai/ai-service';
import { createClient } from '@/lib/supabase/server';
import { after } from 'next/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json();
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

  const contextMessages = getSlidingWindowMessages(messages as ModelMessage[]);
  const allowFullSolution = session.session_status === 'completed';

  // 2. Dialog LLM (Streaming) - 소크라틱 텍스트만 출력
  const systemPrompt = `
${allowFullSolution ? completedSessionSolutionPrompt : socraticTutorPrompt}

[CONTEXT: 학습자가 풀고 있는 문제의 원본 텍스트 및 LaTeX 데이터입니다]
${session.extracted_text}

절대로 JSON 형식을 출력하지 마세요. 오직 학생과 대화하는 한국어 텍스트만 출력하세요.
  `.trim();

  const result = streamText({
    model: huggingface(TEXT_MODEL),
    system: systemPrompt,
    messages: contextMessages,
    onFinish: async () => {
      console.log('[chat/route] Dialog 스트리밍 완료:', sessionId);
    },
  });

  // 3. after()를 사용하여 스트리밍 완료 후 백그라운드 처리
  after(async () => {
    const assistantMessage = await result.text;

    // 3-1. 대화 로그 저장 (dialogue_logs)
    // 마지막 사용자 메시지 저장
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage?.role === 'user') {
      await saveDialogueLog({
        sessionId,
        speaker: 'student',
        messageText: typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : lastUserMessage.content?.map?.((p: any) => p.text || '').join('') || '',
      });
    }

    // AI 응답 저장
    await saveDialogueLog({
      sessionId,
      speaker: 'ai_tutor',
      messageText: assistantMessage,
    });

    // 3-2. 병목 감지 (learning_bottlenecks)
    const fullMessages = [
      ...contextMessages.map((m: any) => ({
        role: m.role,
        content: typeof m.content === 'string'
          ? m.content
          : m.content?.map?.((p: any) => p.text || '').join('') || '',
      })),
      { role: 'assistant', content: assistantMessage },
    ];

    await runBottleneckDetection({
      sessionId,
      messages: fullMessages,
    });
  });

  // 스트리밍 응답 반환
  return result.toUIMessageStreamResponse();
}
