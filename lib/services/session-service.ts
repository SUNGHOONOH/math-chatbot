// ============================================================
// AHA v5 — Session Service (세션 상태 전환 단일 통제)
// ============================================================
// 모든 세션 상태 전환은 반드시 이 파일을 통해서만 수행됩니다.
// 직접 DB 업데이트 / updateSessionStatus 직접 호출 금지.
//
// 허용 상태 전환:
//   NEW          → in_progress   (createSession)
//   in_progress  → completed     (completeSession)
//   in_progress  → viewed_answer (markViewedAnswer)
//   in_progress  → abandoned     (abandonSession)
//   abandoned    → in_progress   (resumeSession)  ← 과거 세션 재진입 전용
//
// "단일 활성 세션" 불변식:
//   학생당 in_progress 세션은 항상 최대 1개.
//   새 세션 생성 시 기존 in_progress → abandoned 처리.
// ============================================================

import { getSupabaseAdmin } from '@/lib/supabase/admin';

export type SessionStatus =
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'viewed_answer';

// 허용 전환 규칙 (From → To)
const ALLOWED_TRANSITIONS: Record<string, SessionStatus[]> = {
  in_progress: ['completed', 'viewed_answer', 'abandoned'],
  abandoned: ['in_progress'],
  // completed, viewed_answer 는 불변 (terminal)
};

function isAllowedTransition(from: string, to: SessionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── 단순 단건 상태 전환 (내부 공통 유틸) ──────────────────────

async function applyStatusTransition(
  sessionId: string,
  to: SessionStatus,
  ownerCheck?: { studentId: string }
): Promise<
  | { success: true; session: { id: string; session_status: string; problem_hash: string; student_id: string } }
  | { success: false; error: string; status: number }
> {
  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from('tutoring_sessions')
    .select('id, student_id, session_status, problem_hash')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    return { success: false, error: '세션을 찾을 수 없습니다.', status: 404 };
  }

  if (ownerCheck && session.student_id !== ownerCheck.studentId) {
    return { success: false, error: '접근 권한이 없습니다.', status: 403 };
  }

  // 이미 같은 상태면 멱등 처리 (성공으로 간주)
  if (session.session_status === to) {
    return { success: true, session };
  }

  if (!isAllowedTransition(session.session_status, to)) {
    return {
      success: false,
      error: `상태 전환 불가: ${session.session_status} → ${to}`,
      status: 409,
    };
  }

  const { error } = await supabase
    .from('tutoring_sessions')
    .update({ session_status: to, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    console.error('[session-service] 상태 전환 실패:', error);
    return { success: false, error: '상태 전환 중 오류가 발생했습니다.', status: 500 };
  }

  return { success: true, session: { ...session, session_status: to } };
}

// ── Public API ─────────────────────────────────────────────

/**
 * 새 튜터링 세션 생성 + 기존 in_progress 세션을 abandoned로 전환.
 * "단일 활성 세션" 불변식 유지.
 */
export async function createSession({
  studentId,
  problemHash,
  extractedText,
}: {
  studentId: string;
  problemHash: string;
  extractedText: string;
}): Promise<string> {
  const supabase = getSupabaseAdmin();

  // 기존 in_progress 세션을 abandoned로 일괄 처리
  const { data: activeSessions } = await supabase
    .from('tutoring_sessions')
    .select('id')
    .eq('student_id', studentId)
    .eq('session_status', 'in_progress');

  if (activeSessions && activeSessions.length > 0) {
    await supabase
      .from('tutoring_sessions')
      .update({ session_status: 'abandoned', updated_at: new Date().toISOString() })
      .in('id', activeSessions.map((s) => s.id));

    console.log(`[session-service] 이전 세션 ${activeSessions.length}개 → abandoned`);
  }

  const { data, error } = await supabase
    .from('tutoring_sessions')
    .insert({
      student_id: studentId,
      problem_hash: problemHash,
      extracted_text: extractedText,
      session_status: 'in_progress',
      has_student_consent: true, // 프로필 온보딩 완료 사용자만 세션 진입 가능
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[session-service] 세션 생성 실패:', error);
    throw error ?? new Error('세션 생성 실패');
  }

  return data.id;
}

/**
 * 세션을 completed로 전환.
 * 사용자 확인 UI 또는 수동 완료 액션에서 호출.
 * 보고서 생성은 lazy — 이곳에서 절대 수행하지 않습니다.
 */
export async function completeSession(
  sessionId: string,
  { studentId }: { studentId: string }
) {
  return applyStatusTransition(sessionId, 'completed', { studentId });
}

/**
 * 학생이 정답을 본 경우 → viewed_answer 전환.
 */
export async function markViewedAnswer(
  sessionId: string,
  { studentId }: { studentId: string }
) {
  return applyStatusTransition(sessionId, 'viewed_answer', { studentId });
}

/**
 * 세션을 abandoned로 전환 (명시적 중단).
 */
export async function abandonSession(
  sessionId: string,
  { studentId }: { studentId: string }
) {
  return applyStatusTransition(sessionId, 'abandoned', { studentId });
}

/**
 * abandoned 세션을 in_progress로 복원 (과거 세션 재진입 전용).
 * 불변식: 동일 학생의 다른 in_progress 세션이 없어야 함. 
 * 있다면 먼저 abandonSession 후 호출할 것.
 */
export async function resumeSession(
  sessionId: string,
  { studentId }: { studentId: string }
) {
  const supabase = getSupabaseAdmin();

  // 다른 in_progress 세션이 있으면 먼저 abandon
  const { data: others } = await supabase
    .from('tutoring_sessions')
    .select('id')
    .eq('student_id', studentId)
    .eq('session_status', 'in_progress')
    .neq('id', sessionId);

  if (others && others.length > 0) {
    await supabase
      .from('tutoring_sessions')
      .update({ session_status: 'abandoned', updated_at: new Date().toISOString() })
      .in('id', others.map((s) => s.id));
  }

  return applyStatusTransition(sessionId, 'in_progress', { studentId });
}

/**
 * 세션 단건 조회 + 소유권 확인 유틸.
 */
export async function getSessionForUser(sessionId: string, studentId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('tutoring_sessions')
    .select('id, student_id, session_status, problem_hash, extracted_text, created_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (!data || data.student_id !== studentId) return null;
  return data;
}
