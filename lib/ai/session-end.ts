// ============================================================
// AHA v5 — Part 2: 세션 종료 후 구조화 데이터 추출 (onSessionEnd)
// ============================================================
// AI가 아닌 "백엔드 함수"로서, 대화가 끝나면 Text LLM을 호출하여
// 전체 대화를 5개 데이터 덩어리 JSON으로 파싱하고 Supabase에 저장합니다.
// ============================================================

import { generateText } from 'ai';
import { huggingface } from '@ai-sdk/huggingface';
import { z } from 'zod';
import { TEXT_MODEL } from './models';
import { sessionEndPrompt } from './prompts';
import { getSupabaseAdmin } from '../supabase/client';

// ----- Zod 스키마: 5개 데이터 덩어리 -----

export const sessionChunkSchema = z.object({
  problemId: z.string().describe('문제 식별 ID (예: quad_eq_001)'),
  strategySnapshot: z.object({
    approach: z.string().describe('사용된 풀이 접근법'),
    concepts: z.array(z.string()).describe('관련 수학 개념 목록'),
    steps: z.array(z.string()).describe('풀이 단계 요약'),
  }).describe('문제 풀이 전략 스냅샷'),
  nodePosterior: z.record(z.string(), z.number()).describe('개념별 이해도 확률 (0~1)'),
  sessionResult: z.enum(['solved', 'partial', 'stuck']).describe('세션 결과'),
  errorPatterns: z.array(z.string()).describe('학생이 보인 오류 패턴'),
});

export type SessionChunk = z.infer<typeof sessionChunkSchema>;

// ----- JSON 추출 헬퍼 -----
// LLM 응답에서 JSON 블록을 찾아 파싱합니다.
// "```json ... ```" 또는 순수 JSON 또는 { ... } 블록 모두 처리합니다.
function extractJSON(text: string): any | null {
  // 1. ```json ... ``` 코드 블록에서 추출
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch { }
  }

  // 2. 가장 바깥쪽 { ... } 블록 추출
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(text.slice(braceStart, braceEnd + 1));
    } catch { }
  }

  return null;
}

// ----- onSessionEnd 함수 -----

interface SessionEndParams {
  sessionId: string;
  studentId: string;
  messages: Array<{ role: string; content: string }>;
}

export async function onSessionEnd({ sessionId, studentId, messages }: SessionEndParams) {
  const supabaseAdmin = getSupabaseAdmin();

  // 1. 전체 대화를 텍스트로 변환
  const fullTranscript = messages
    .map((m) => `[${m.role === 'user' ? '학생' : 'AI'}]: ${m.content}`)
    .join('\n');

  // 2. 검증 DB (validations) — 원문 그대로 저장
  await supabaseAdmin.from('validations').insert({
    session_id: sessionId,
    raw_transcript: fullTranscript,
  } as any);

  // 3. Part 2: Text LLM으로 구조화 데이터 추출
  //    Output.object() 대신 프롬프트 기반 JSON 요청 + 수동 파싱
  try {
    const result = await generateText({
      model: huggingface(TEXT_MODEL),
      prompt: sessionEndPrompt(fullTranscript),
    });

    // LLM 응답에서 JSON 추출
    const rawJSON = extractJSON(result.text);

    if (!rawJSON) {
      console.warn('[onSessionEnd] LLM 응답에서 JSON을 찾지 못함:', result.text.slice(0, 200));
      throw new Error('JSON not found in LLM response');
    }

    // zod로 검증
    const parsed = sessionChunkSchema.parse(rawJSON);

    // 4. 운영 DB (operations) — 구조화된 5덩어리 저장
    await supabaseAdmin.from('operations').insert({
      session_id: sessionId,
      student_id: studentId,
      chunk_index: 0,
      dialog_transcript: fullTranscript,
      node_posterior: parsed.nodePosterior,
    } as any);

    console.log('[onSessionEnd] 구조화 데이터 저장 완료:', parsed.sessionResult);
    return parsed;
  } catch (error) {
    // LLM 파싱 실패 시에도 원문은 이미 검증 DB에 저장되어 있으므로 데이터 손실 없음
    console.error('[onSessionEnd] 구조화 추출 실패, 원문은 저장됨:', error);

    // Fallback: 최소한의 운영 데이터라도 저장
    await supabaseAdmin.from('operations').insert({
      session_id: sessionId,
      student_id: studentId,
      chunk_index: 0,
      dialog_transcript: fullTranscript,
      node_posterior: { parse_failed: true },
    } as any);
  }

  return null;
}
