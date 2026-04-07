import { createClient } from '@/lib/supabase/server';
import type { SessionItem } from './sidebar';

export default async function SessionList() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // 1. 세션 목록 패칭 (최신순, 최대 30개)
  const { data: rawSessions } = await supabase
    .from('tutoring_sessions')
    .select('id, session_status, created_at, extracted_text')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (!rawSessions || rawSessions.length === 0) return [];

  const sessions: SessionItem[] = rawSessions.map((s) => ({
    id: s.id,
    session_status: s.session_status,
    created_at: s.created_at,
    first_message: s.extracted_text,
  }));

  return sessions;
}

/**
 * 전역 사이드바에서 사용할 세션 목록 패칭 유틸리티 (서버 전용)
 */
export async function getSidebarSessions() {
  return await SessionList();
}
