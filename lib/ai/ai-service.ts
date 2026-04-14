import { VISION_MODEL, TAGGING_MODEL, EMBEDDING_MODEL, TEXT_MODEL } from './models';
import { buildBottleneckDetectionPrompt } from './prompts';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { CHAT_CONTEXT_WINDOW_SIZE, RAG_SIMILARITY_THRESHOLD } from '@/lib/constants';
import crypto from 'crypto';

const RAG_MATCH_COUNT = 3;

/**
 * 텍스트 기반의 문제 해시 생성 (DB 조회용)
 */
export function generateProblemHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

/**
 * [Core] HuggingFace 통합 API 호출 엔진
 */
async function hfFetch(url: string, body: any, options?: { timeoutMs?: number }) {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs;
  const timeoutId = timeoutMs
    ? setTimeout(() => controller.abort(`timeout:${timeoutMs}`), timeoutMs)
    : null;

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      throw new Error(`요청 시간 초과 (${timeoutMs}ms)`);
    }

    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HF API Error: ${response.status} - ${errorText}`);
  }

  return response;
}

/**
 * [Core] 단일 텍스트 생성 전용 헬퍼
 */
export async function hfGenerateText({
  model,
  inputs,
  parameters = { max_new_tokens: 1024, temperature: 0.3 },
  isVision = false,
  system,
  timeoutMs,
}: {
  model: string;
  inputs: any;
  parameters?: any;
  isVision?: boolean;
  system?: string;
  timeoutMs?: number;
}): Promise<string> {
  const url = `https://router.huggingface.co/v1/chat/completions`;
  const messages = isVision 
    ? [
        {
          role: 'user',
          content: [
            { type: 'text', text: inputs.text || '이미지 안의 정보를 추출하세요.' },
            { type: 'image_url', image_url: { url: inputs.image } },
          ],
        },
      ]
    : [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: typeof inputs === 'string' ? inputs : JSON.stringify(inputs) }
      ];

  try {
    const response = await hfFetch(
      url,
      {
        model,
        messages,
        max_tokens: parameters.max_new_tokens || 1024,
        temperature: parameters.temperature || 0.3,
      },
      { timeoutMs }
    );

    const result = await response.json();
    return result.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    throw new Error(`[hfGenerateText] 호출 실패 (${model}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * [공통] HuggingFace Inference API 스트리밍 헬퍼
 */
export async function hfStreamText({
  model,
  messages,
  system,
  onFinish,
}: {
  model: string;
  messages: any[];
  system?: string;
  onFinish?: (text: string) => void;
}): Promise<ReadableStream> {
  const url = `https://router.huggingface.co/v1/chat/completions`;
  
  const formattedMessages = system 
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  try {
    const response = await hfFetch(url, {
      model,
      messages: formattedMessages,
      max_tokens: 1024,
      temperature: 0.7,
      stream: true,
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    return new ReadableStream({
      async start(controller) {
        if (!reader) return;
        let fullText = '';
        try {
          let partialChunk = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = partialChunk + decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            partialChunk = lines.pop() || '';
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
              
              if (trimmedLine.startsWith('data: ')) {
                try {
                  const data = JSON.parse(trimmedLine.slice(6));
                  const content = data.choices?.[0]?.delta?.content || '';
                  if (content) {
                    fullText += content;
                    controller.enqueue(`0:${JSON.stringify(content)}\n`);
                  }
                } catch (e) {
                  // 파싱 실패시 무시
                }
              }
            }
          }
        } catch (err) {
          console.error(`[hfStreamText] 스트림 중단 에러 (${model}):`, err);
          controller.error(err);
        } finally {
          onFinish?.(fullText.trim());
          controller.close();
        }
      },
    });
  } catch (err) {
    throw new Error(`[hfStreamText] 초기화 실패 (${model}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

function isPdfUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.pdf');
  } catch {
    return url.toLowerCase().split('?')[0].endsWith('.pdf');
  }
}

/**
 * [Route 1] VISION_MODEL을 사용하여 이미지에서 LaTeX 및 텍스트 추출
 */
export async function performOCR(imageUrls: string[]): Promise<string> {
  if (imageUrls.length === 0) return '';

  try {
    console.log(`[ai-service] OCR 시도 중 (${VISION_MODEL})...`);
    
    const text = await hfGenerateText({
      model: VISION_MODEL,
      inputs: {
        image: imageUrls[0],
        text: '이미지 안의 수학 문제를 가능한 한 정확히 OCR 하세요. 수식은 LaTeX로 보존하고, 문제 원문은 줄바꿈을 유지하세요. 설명 없이 문제 텍스트만 출력하세요.',
      },
      parameters: { max_new_tokens: 2048 },
      isVision: true,
      timeoutMs: 45000,
    });

    return text.trim();
  } catch (error) {
    throw new Error(`OCR 분석 실패 (${VISION_MODEL}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

export { isPdfUrl };

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

  // 2. 기존 세션들을 abandoned 상태로 변경 (분석은 세션 리포트 조회 시 온디맨드로 처리)
  if (activeSessions && activeSessions.length > 0) {
    const activeIds = activeSessions.map(s => s.id);
    
    await supabase
      .from('tutoring_sessions')
      .update({ 
        session_status: 'abandoned',
        updated_at: new Date().toISOString()
      })
      .in('id', activeIds);

    console.log(`[ai-service] 이전 세션 ${activeIds.length}개 일시정지 완료. 분석은 리포트 조회 시 수행됩니다.`);
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
 * HuggingFace Inference API를 사용하여 텍스트 임베딩 생성 (1024차원)
 * multilingual-e5-large-instruct 모델은 입력 데이터의 성격에 따라 프리픽스를 붙입니다.
 * type이 'passage'인 경우 "passage: "를, 'query'인 경우 "query: "를 붙여 매칭 성능을 최적화합니다.
 */
export async function generateEmbedding(text: string, type: 'query' | 'passage' = 'passage'): Promise<number[]> {
  const prefix = type === 'query' ? 'query: ' : 'passage: ';
  
  try {
    const response = await hfFetch(`https://router.huggingface.co/v1/embeddings`, { 
      model: EMBEDDING_MODEL,
      input: prefix + text.trim() 
    });

    const embedding = await response.json();
    return Array.isArray(embedding[0]) ? embedding[0] : embedding;
  } catch (err) {
    throw new Error(`임베딩 생성 실패 (${EMBEDDING_MODEL}): ${err instanceof Error ? err.message : String(err)}`);
  }
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
  problemText,
  messages,
}: {
  sessionId: string;
  problemText: string;
  messages: Array<{ role: string; content: string }>;
}) {
  try {
    // 1. Tagging LLM 호출: 대화에서 병목 지점 식별
    const turnContent = messages
      .map((m, index) => {
        const speaker = m.role === 'assistant' ? 'AI' : '학생';
        return `[T${index + 1}] ${speaker}: ${m.content}`;
      })
      .join('\n');

    const text = await hfGenerateText({
      model: TAGGING_MODEL,
      inputs: `${buildBottleneckDetectionPrompt(problemText)}\n\n대화 내용:\n${turnContent}\n\n결과 (JSON):`,
      parameters: { max_new_tokens: 2048, temperature: 0.1 },
    });

    // 2. JSON 파싱 (LLM 응답에서 구조화된 데이터 추출)
    // 마크다운 코드블록, 앞뒤 텍스트, 중간 잘림 등에 강인하게 처리
    let detectionResult = {
      has_bottleneck: false,
      bottleneck_type: 'UNKNOWN',
      bottleneck_title: '',
      struggle_description: '',
      evidence: [] as string[],
      is_resolved: false,
      resolution_signal: '',
      confidence: 0,
    };

    try {
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const rawJson = codeBlockMatch
        ? codeBlockMatch[1]
        : text.match(/\{[\s\S]*\}/)?.[0];
      if (rawJson) {
        detectionResult = JSON.parse(rawJson);
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

    const normalizedType =
      typeof detectionResult.bottleneck_type === 'string' && detectionResult.bottleneck_type.trim()
        ? detectionResult.bottleneck_type.trim().toUpperCase()
        : 'UNKNOWN';
    const normalizedTitle =
      typeof detectionResult.bottleneck_title === 'string'
        ? detectionResult.bottleneck_title.trim()
        : '';
    const normalizedDescription = detectionResult.struggle_description.trim();
    const ragReadyDescription = normalizedDescription.includes('|')
      ? normalizedDescription
      : `${normalizedType} | ${normalizedDescription}`;
    const storageDescription = normalizedTitle
      ? `${ragReadyDescription} (${normalizedTitle})`
      : ragReadyDescription;

    // 4. 임베딩 생성 (struggle_description → vector)
    const embedding = await generateEmbedding(storageDescription);

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
        struggle_description: storageDescription,
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
    const text = await hfGenerateText({
      model: TAGGING_MODEL,
      inputs: `${conceptExtractionPrompt}\n\n컨텍스트:\n${contextForLLM}\n\n결과 (JSON):`,
      parameters: { max_new_tokens: 2048, temperature: 0.1 },
    });

    // 5. JSON 파싱 (마크다운 코드블록 및 앞뒤 텍스트에 강인하게 처리)
    let requiredConcepts: string[] = [];
    try {
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const rawJson = codeBlockMatch
        ? codeBlockMatch[1]
        : text.match(/\{[\s\S]*\}/)?.[0];
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
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
