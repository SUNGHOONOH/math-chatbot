// ============================================================
// AHA v5 — Report Service (지연 리포트 생성 단일 통제)
// ============================================================
// 세션 리포트 조회 시 required_concepts가 없으면 여기서만 생성합니다.
// 리포트 page.tsx와 report API route 양쪽에서 이 함수를 호출하므로
// 로직이 한 곳에만 존재합니다.
// ============================================================

import { getSupabaseAdmin } from '@/lib/supabase/client';
import { extractAndUpdateRequiredConcepts } from '@/lib/ai/ai-service';

export interface SessionReport {
  session: {
    id: string;
    status: string;
    extractedText: string;
    createdAt: string;
    problemHash: string;
  };
  analysis: {
    requiredConcepts: string[];
    baseDifficulty: number | null;
    isHumanVerified: boolean;
    wasAnalyzedOnDemand: boolean;
  };
  dialogueLogs: Array<{
    id: string;
    speaker: string;
    text: string;
    createdAt: string;
  }>;
  bottlenecks: Array<{
    id: string;
    conceptId: string | null;
    description: string;
    isResolved: boolean;
    candidates: unknown;
    createdAt: string;
  }>;
}

/**
 * 세션 리포트를 조회합니다.
 * required_concepts가 비어있으면 즉시 Lazy Analysis를 수행하고 결과를 반환합니다.
 * 어떤 page/route도 이 함수를 직접 중복 구현하지 않습니다.
 *
 * @throws 세션이 completed가 아닌 경우 { code: 'NOT_COMPLETED' } 오류
 */
export async function getOrBuildSessionReport(
  sessionId: string,
  studentId: string
): Promise<SessionReport> {
  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from('tutoring_sessions')
    .select('id, student_id, session_status, problem_hash, extracted_text, created_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || session.student_id !== studentId) {
    const err = new Error('세션을 찾을 수 없습니다.');
    (err as any).code = 'NOT_FOUND';
    (err as any).status = 404;
    throw err;
  }

  if (session.session_status !== 'completed') {
    const err = new Error(`세션이 완료 상태가 아닙니다. 현재 상태: ${session.session_status}`);
    (err as any).code = 'NOT_COMPLETED';
    (err as any).status = 403;
    throw err;
  }

  // strategy_graphs 조회
  const { data: graph } = await supabase
    .from('strategy_graphs')
    .select('required_concepts, base_difficulty, is_human_verified')
    .eq('problem_hash', session.problem_hash)
    .maybeSingle();

  // ── Lazy Analysis: required_concepts가 없으면 지금 분석 ──
  const needsAnalysis = !graph?.required_concepts?.length;
  if (needsAnalysis) {
    console.log(`[report-service] Lazy Analysis 시작: ${sessionId}`);
    try {
      await extractAndUpdateRequiredConcepts({
        sessionId,
        problemHash: session.problem_hash,
      });
    } catch (err) {
      console.error('[report-service] Lazy Analysis 실패 (부분 리포트 반환):', err);
    }
  }

  // 분석 후 최신 데이터 재조회
  const [{ data: updatedGraph }, { data: logs }, { data: bottlenecks }] =
    await Promise.all([
      supabase
        .from('strategy_graphs')
        .select('required_concepts, base_difficulty, is_human_verified')
        .eq('problem_hash', session.problem_hash)
        .maybeSingle(),
      supabase
        .from('dialogue_logs')
        .select('id, speaker, message_text, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
      supabase
        .from('learning_bottlenecks')
        .select('id, mapped_concept_id, struggle_description, is_resolved_by_student, candidate_matches, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
    ]);

  return {
    session: {
      id: session.id,
      status: session.session_status,
      extractedText: session.extracted_text,
      createdAt: session.created_at,
      problemHash: session.problem_hash,
    },
    analysis: {
      requiredConcepts: updatedGraph?.required_concepts ?? [],
      baseDifficulty: updatedGraph?.base_difficulty ?? null,
      isHumanVerified: updatedGraph?.is_human_verified ?? false,
      wasAnalyzedOnDemand: needsAnalysis,
    },
    dialogueLogs: (logs ?? []).map((log) => ({
      id: log.id,
      speaker: log.speaker,
      text: log.message_text,
      createdAt: log.created_at,
    })),
    bottlenecks: (bottlenecks ?? []).map((b) => ({
      id: b.id,
      conceptId: b.mapped_concept_id,
      description: b.struggle_description,
      isResolved: b.is_resolved_by_student,
      candidates: b.candidate_matches,
      createdAt: b.created_at,
    })),
  };
}
