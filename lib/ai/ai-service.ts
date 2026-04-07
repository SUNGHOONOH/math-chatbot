// ============================================================
// AHA v5 — AI Service Layer (초경량 3+1 DB 구조 대응)
// ============================================================
// Route 1: OCR, 전략 그래프 탐색, 세션 생성
// Route 2: 병목 감지 (RAG 벡터 매칭 + learning_bottlenecks INSERT)
// ============================================================

import { generateText } from 'ai';
import { huggingface } from '@ai-sdk/huggingface';
import { VISION_MODEL, TAGGING_MODEL, EMBEDDING_MODEL } from './models';
import { bottleneckDetectionPrompt } from './prompts';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { CHAT_CONTEXT_WINDOW_SIZE, RAG_SIMILARITY_THRESHOLD } from '@/lib/constants';
import crypto from 'crypto';
import { after } from 'next/server';

const RAG_MATCH_COUNT = 3;

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

export function normalizeProblemText(text: string): string {
  return text.trim();
}

/**
 * [Route 1] DB에서 해당 문제의 전략 그래프가 있는지 확인
 */
export async function getStrategyGraph(problemHash: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('strategy_graphs')
    .select('*')
    .eq('problem_hash', problemHash)
    .maybeSingle();

  if (error) {
    console.error('[ai-service] getStrategyGraph 에러:', error);
    return null;
  }

  return data;
}

export async function ensureStrategyGraphExists(problemHash: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('strategy_graphs')
    .upsert(
      {
        problem_hash: problemHash,
        required_concepts: [],
        base_difficulty: 3,
        intended_path: [],
        graph_data: {},
        is_human_verified: false,
      },
      { onConflict: 'problem_hash', ignoreDuplicates: true }
    );

  if (error) {
    console.error('[ai-service] ensureStrategyGraphExists 에러:', error);
    throw error;
  }
}

/**
 * [Route 1] 새 튜터링 세션 생성 (1 Problem = 1 Session)
 */
export async function createTutoringSession({
  studentId,
  problemHash,
  extractedText,
  hasStudentConsent,
}: {
  studentId: string;
  problemHash: string;
  extractedText: string;
  hasStudentConsent: boolean;
}) {
  const supabase = getSupabaseAdmin();

  // 1. 기존 진행 중인 세션들(in_progress) 찾기
  const { data: activeSessions } = await supabase
    .from('tutoring_sessions')
    .select('id, problem_hash')
    .eq('student_id', studentId)
    .eq('session_status', 'in_progress');

  // 2. 기존 세션들을 abandoned 상태로 변경하고, 배경 분석(Lazy Loading) 예약
  if (activeSessions && activeSessions.length > 0) {
    const activeIds = activeSessions.map(s => s.id);
    
    await supabase
      .from('tutoring_sessions')
      .update({ 
        session_status: 'abandoned',
        updated_at: new Date().toISOString()
      })
      .in('id', activeIds);

    // edge/serverless 환경에서는 next/after를 사용하여 
    // 비동기 백그라운드 태스크가 안전하게 실행되도록 보장합니다
    after(() => {
      activeSessions.forEach(async (session) => {
        console.log(`[ai-service] 이전 세션 자동 일시정지 및 분석 시작: ${session.id}`);
        await extractAndUpdateRequiredConcepts({
          sessionId: session.id,
          problemHash: session.problem_hash,
        });
      });
    });
  }

  const { data, error } = await supabase
    .from('tutoring_sessions')
    .insert({
      student_id: studentId,
      problem_hash: problemHash,
      extracted_text: extractedText,
      session_status: 'in_progress' as const,
      has_student_consent: hasStudentConsent,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ai-service] createTutoringSession 에러:', error);
    throw error;
  }

  return data.id;
}

/**
 * 세션 상태 전환 (in_progress ↔ abandoned ↔ completed 등)
 * "새 질문" 클릭 시 기존 세션을 abandoned로,
 * 과거 세션 재진입 시 다시 in_progress로 복원합니다.
 */
export async function updateSessionStatus(
  sessionId: string,
  status: 'in_progress' | 'completed' | 'abandoned' | 'viewed_answer'
) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('tutoring_sessions')
    .update({
      session_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.error('[ai-service] updateSessionStatus 에러:', error);
  }
}

/**
 * [Route 2] 대화 로그를 dialogue_logs 테이블에 저장
 */
export async function saveDialogueLog({
  sessionId,
  speaker,
  messageText,
}: {
  sessionId: string;
  speaker: 'student' | 'ai_tutor';
  messageText: string;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('dialogue_logs').insert({
    session_id: sessionId,
    speaker,
    message_text: messageText,
  });

  if (error) {
    console.error('[ai-service] saveDialogueLog 에러:', error);
  }
}

export async function getTutoringSession(sessionId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tutoring_sessions')
    .select('id, student_id, extracted_text, session_status, has_student_consent')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('[ai-service] getTutoringSession 에러:', error);
    throw error;
  }

  return data;
}

export function getSlidingWindowMessages<T>(messages: T[]): T[] {
  return messages.slice(-CHAT_CONTEXT_WINDOW_SIZE);
}

/**
 * HuggingFace Inference API를 사용하여 텍스트 임베딩 생성 (1536차원)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    `https://api-inference.huggingface.co/pipeline/feature-extraction/${EMBEDDING_MODEL}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    }
  );

  if (!response.ok) {
    throw new Error(`임베딩 생성 실패: ${response.statusText}`);
  }

  const embedding = await response.json();
  // HF feature-extraction은 [[...]] 형태로 반환할 수 있음
  return Array.isArray(embedding[0]) ? embedding[0] : embedding;
}

/**
 * [Route 2] 백그라운드 병목 감지 및 RAG 분류
 * next/after() 내에서 실행될 것을 권장
 * 
 * AGENTS.md §2 준수:
 * - 유사도 0.75 이상 → 1위 concept_code를 mapped_concept_id에 저장
 * - 유사도 0.75 미만 → 'NEW_NODE'로 저장
 * - 상위 3개 후보는 항상 candidate_matches에 보존
 */
export async function runBottleneckDetection({
  sessionId,
  messages,
}: {
  sessionId: string;
  messages: Array<{ role: string; content: string }>;
}) {
  try {
    // 1. Tagging LLM 호출: 대화에서 병목 지점 식별
    const turnContent = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const { text } = await generateText({
      model: huggingface(TAGGING_MODEL),
      system: bottleneckDetectionPrompt,
      prompt: turnContent,
    });

    // 2. JSON 파싱 (LLM 응답에서 구조화된 데이터 추출)
    let detectionResult = {
      has_bottleneck: false,
      struggle_description: '',
      is_resolved: false,
    };

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        detectionResult = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[ai-service] Tagging JSON 파싱 에러:', e);
      return; // 파싱 실패 시 저장하지 않음
    }

    // 3. 병목이 감지되지 않았으면 저장하지 않음 (AGENTS.md §10: 막혔을 때만 저장)
    if (!detectionResult.has_bottleneck || !detectionResult.struggle_description) {
      console.log('[ai-service] 병목 미감지, 저장 스킵:', sessionId);
      return;
    }

    // 4. 임베딩 생성 (struggle_description → vector)
    const embedding = await generateEmbedding(detectionResult.struggle_description);

    // 5. RAG 벡터 매칭: concept_nodes_reference에서 상위 3개 후보 검색
    const supabase = getSupabaseAdmin();
    const { data: candidates, error: rpcError } = await supabase.rpc(
      'match_concept_nodes',
      {
        query_embedding: JSON.stringify(embedding),
        match_threshold: 0.0, // 임계값 없이 전부 가져온 뒤 로직에서 판단
        match_count: RAG_MATCH_COUNT,
      }
    );

    if (rpcError) {
      console.error('[ai-service] RAG 매칭 에러:', rpcError);
    }

    // 6. 유사도 기준으로 매핑 결정
    const candidateMatches = (candidates || []).map((c: any) => ({
      id: c.concept_code,
      score: parseFloat(c.similarity.toFixed(4)),
    }));

    const topMatch = candidateMatches[0];
    const mappedConceptId =
      topMatch && topMatch.score >= RAG_SIMILARITY_THRESHOLD
        ? topMatch.id
        : 'NEW_NODE';

    // 7. learning_bottlenecks 테이블에 INSERT
    const { error: insertError } = await supabase
      .from('learning_bottlenecks')
      .insert({
        session_id: sessionId,
        mapped_concept_id: mappedConceptId,
        candidate_matches: candidateMatches,
        struggle_description: detectionResult.struggle_description,
        searchable_vector: embedding,
        is_resolved_by_student: detectionResult.is_resolved || false,
      });

    if (insertError) {
      console.error('[ai-service] learning_bottlenecks INSERT 에러:', insertError);
    } else {
      console.log(
        `[ai-service] 병목 저장 완료: ${mappedConceptId} (유사도: ${topMatch?.score ?? 'N/A'})`,
        sessionId
      );
    }
  } catch (err) {
    console.error('[ai-service] 병목 감지 실패:', err);
  }
}

/**
 * [세션 종료] required_concepts 지연 수집 (Lazy Loading - Phase 2)
 * 
 * 세션이 종료(completed/abandoned)될 때 호출하여
 * strategy_graphs의 required_concepts만 UPDATE합니다.
 * 
 * ⚠️ intended_path, graph_data는 야간 배치용이므로 절대 건드리지 않습니다.
 */
export async function extractAndUpdateRequiredConcepts({
  sessionId,
  problemHash,
}: {
  sessionId: string;
  problemHash: string;
}) {
  try {
    const supabase = getSupabaseAdmin();

    // 1. 세션의 extracted_text(문제 원문) 가져오기
    const { data: session } = await supabase
      .from('tutoring_sessions')
      .select('extracted_text')
      .eq('id', sessionId)
      .single();

    if (!session?.extracted_text) {
      console.warn('[ai-service] extractAndUpdate: extracted_text 없음, 스킵:', sessionId);
      return;
    }

    // 2. 해당 세션의 전체 대화 로그 가져오기
    const { data: logs } = await supabase
      .from('dialogue_logs')
      .select('speaker, message_text')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (!logs || logs.length === 0) {
      console.warn('[ai-service] extractAndUpdate: 대화 로그 없음, 스킵:', sessionId);
      return;
    }

    // 3. 프롬프트 컨텍스트 조립
    const dialogueTranscript = logs
      .map((l) => `${l.speaker === 'student' ? '학생' : 'AI'}: ${l.message_text}`)
      .join('\n');

    const contextForLLM = `[문제 원문]\n${session.extracted_text}\n\n[전체 대화 기록]\n${dialogueTranscript}`;

    // 4. Tagging LLM 호출: required_concepts만 추출
    const { conceptExtractionPrompt } = await import('./prompts');
    const { text } = await generateText({
      model: huggingface(TAGGING_MODEL),
      system: conceptExtractionPrompt,
      prompt: contextForLLM,
    });

    // 5. JSON 파싱
    let requiredConcepts: string[] = [];
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.required_concepts)) {
          requiredConcepts = parsed.required_concepts;
        }
      }
    } catch (e) {
      console.error('[ai-service] 개념 추출 JSON 파싱 에러:', e);
      return;
    }

    if (requiredConcepts.length === 0) {
      console.warn('[ai-service] 추출된 개념이 0개, 스킵:', sessionId);
      return;
    }

    // 6. strategy_graphs UPDATE (required_concepts만, intended_path/graph_data는 건드리지 않음)
    const { error: updateError } = await supabase
      .from('strategy_graphs')
      .update({ required_concepts: requiredConcepts })
      .eq('problem_hash', problemHash);

    if (updateError) {
      console.error('[ai-service] strategy_graphs UPDATE 에러:', updateError);
    } else {
      console.log(
        `[ai-service] required_concepts 업데이트 완료 (${requiredConcepts.length}개):`,
        problemHash
      );
    }
  } catch (err) {
    console.error('[ai-service] extractAndUpdateRequiredConcepts 실패:', err);
  }
}
