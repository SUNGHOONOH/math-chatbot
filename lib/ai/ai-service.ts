import { generateText } from 'ai';
import { huggingface } from '@ai-sdk/huggingface';
import { VISION_MODEL, TAGGING_MODEL } from './models';
import { taggingPrompt } from './prompts';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { Database } from '@/lib/db/schema';
import crypto from 'crypto';

/**
 * 텍스트 기반의 문제 해시 생성 (DB 조회용)
 */
export function generateProblemHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

/**
 * [Route 1] VISION_MODEL을 사용하여 이미지에서 LaTeX 및 텍스트 추출
 */
export async function performOCR(imageUrls: string[]): Promise<string> {
  if (imageUrls.length === 0) return '';

  const { text } = await generateText({
    model: huggingface(VISION_MODEL),
    messages: [
      {
        role: 'user',
        content: [
          ...imageUrls.map(url => ({ type: 'image' as const, image: new URL(url) })),
          { type: 'text' as const, text: '이미지에서 모든 수학 문제의 텍스트와 수식을 LaTeX 형식으로 추출해 주세요. 텍스트만 출력하세요.' },
        ],
      },
    ],
  });

  return text.trim();
}

/**
 * [Route 1] DB에서 해당 문제의 전략 그래프가 있는지 확인
 */
export async function getStrategyGraph(problemId: string) {
  const supabase = getSupabaseAdmin() as any; // Cast for now if getSupabaseAdmin doesn't return typed client
  const { data, error } = await supabase
    .from('strategy_graphs')
    .select('*')
    .eq('problem_id', problemId)
    .maybeSingle();

  if (error) {
    console.error('[ai-service] getStrategyGraph 에러:', error);
    return null;
  }

  return data;
}

/**
 * [Route 2] 백그라운드에서 Tagging LLM 실행 및 결과 저장
 * next/after() 내에서 실행될 것을 권장
 */
export async function runBackgroundTagging({
  sessionId,
  studentId,
  messages,
}: {
  sessionId: string;
  studentId: string;
  messages: any[];
}) {
  try {
    const lastMessage = messages[messages.length - 1];
    const turnContent = `
      [Conversation History]
      ${messages.map(m => `${m.role}: ${m.content}`).join('\n')}
    `;

    // Tagging LLM 호출 (비스트리밍)
    const { text } = await generateText({
      model: huggingface(TAGGING_MODEL),
      system: taggingPrompt,
      prompt: turnContent,
    });

    let nodePosterior = {};
    try {
      // JSON 추출 (LLM이 마크다운 등을 섞어 뱉을 경우 대비)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        nodePosterior = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[ai-service] JSON 파싱 에러:', e, text);
    }

    // Supabase operations 테이블에 INSERT
    const supabase = getSupabaseAdmin() as any;
    const { error } = await supabase.from('operations').insert({
      session_id: sessionId,
      student_id: studentId,
      chunk_index: messages.length, // 현재 턴 번호
      dialog_transcript: lastMessage.content,
      node_posterior: nodePosterior,
    });

    if (error) throw error;
    console.log('[ai-service] Tagging 데이터 저장 완료:', sessionId);
  } catch (err) {
    console.error('[ai-service] 백그라운드 태깅 실패:', err);
  }
}
