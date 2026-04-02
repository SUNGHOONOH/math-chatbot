import { streamText } from 'ai';
import { huggingface } from '@ai-sdk/huggingface';
import { TEXT_MODEL } from '@/lib/ai/models';
import { socraticTutorPrompt, fullSolutionPrompt } from '@/lib/ai/prompts';
import { runBackgroundTagging } from '@/lib/ai/ai-service';
import { createClient } from '@/lib/supabase/server';
import { after } from 'next/server';

export const maxDuration = 60;

/**
 * [AHA v5 Route 2] 실시간 소크라틱 대화 및 백그라운드 태깅 전용 API
 */
export async function POST(req: Request) {
  const { messages, sessionId, extractedText, isShowFullSolution } = await req.json();

  // 1. Supabase Auth 세션에서 실제 유저의 아이디를 가져옵니다.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const studentId = user?.id || 'anonymous';

  // 2. [AHA v5 Stage 2] Dialog LLM (Streaming) - Qwen3.5-4B
  // 이미지 없이 라우터 1에서 추출한 'extractedText'를 시스템 프롬프트에 주입
  const systemPrompt = `
    ${isShowFullSolution ? fullSolutionPrompt : socraticTutorPrompt}
    
    [CONTEXT: 학습자가 풀고 있는 문제의 원본 텍스트 및 LaTeX 데이터입니다]
    ${extractedText}
    
    절대로 JSON 형식을 출력하지 마세요. 오직 학생과 대화하는 한국어 텍스트만 출력하세요.
  `;

  const result = streamText({
    model: huggingface(TEXT_MODEL),
    system: systemPrompt,
    messages: messages,
    onFinish: async ({ text }) => {
      // 대화 로그 및 세션 종료 처리는 after() 또는 별도의 세션 종료 API에서 수행 권장
      console.log('[chat/route] Dialog 스트리밍 완료:', sessionId);
    },
  });

  // 3. [AHA v5 Stage 2] Tagging LLM (Background) - Qwen2.5-Math-7B
  // after()를 사용하여 스트리밍 응답 전송 후에도 백그라운드 작업이 완료될 때까지 컨테이너 유지 보장
  after(async () => {
    console.log('[chat/route] 백그라운드 태깅 시작...');

    // 현재 대화 턴(사용자 메시지 + AI 응답)을 포함하여 태깅 수행
    const lastAssistantMessage = await result.text;
    const currentMessagesWithResponse = [
      ...messages,
      { role: 'assistant', content: lastAssistantMessage }
    ];

    await runBackgroundTagging({
      sessionId,
      studentId,
      messages: currentMessagesWithResponse,
    });
  });

  // 스트리밍 응답 반환
  return result.toUIMessageStreamResponse();
}
