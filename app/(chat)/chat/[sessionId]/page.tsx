// ============================================================
// AHA v5 — /chat/[sessionId]: 기존 대화 복원 페이지
// ============================================================
// 서버 컴포넌트로 dialogue_logs에서 대화 기록을 패칭하고
// ChatInterface에 initialMessages로 전달하여 복원합니다.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import ChatInterface from '@/app/(chat)/_components/chat-interface';

export default async function SessionChatPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. 세션 존재 여부 및 소유권 확인
  const { data: session } = await supabase
    .from('tutoring_sessions')
    .select('id, student_id, session_status, problem_hash, extracted_text')
    .eq('id', sessionId)
    .single();

  if (!session || session.student_id !== user.id) {
    notFound();
  }

  // 2. 세션 상태를 in_progress로 복원 (abandoned에서 돌아온 경우)
  if (session.session_status === 'abandoned') {
    await supabase
      .from('tutoring_sessions')
      .update({ session_status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  }

  // 3. dialogue_logs에서 대화 기록 패칭 (시간순)
  const { data: logs } = await supabase
    .from('dialogue_logs')
    .select('id, speaker, message_text, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  // 4. Vercel AI SDK의 Message 형식으로 변환
  const initialMessages = (logs || []).map((log) => ({
    id: log.id,
    role: (log.speaker === 'student' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: log.message_text,
  }));

  return (
    <ChatInterface
      sessionId={sessionId}
      initialMessages={initialMessages}
      extractedText={session.extracted_text}
    />
  );
}
