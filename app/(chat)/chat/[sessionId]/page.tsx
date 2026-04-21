// ============================================================
// AHA v5 — /chat/[sessionId]: 기존 대화 복원 페이지
// ============================================================
// 서버 컴포넌트로 dialogue_logs에서 대화 기록을 패칭하고
// ChatInterface에 initialMessages로 전달하여 복원합니다.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { buildLoginPath } from '@/lib/auth';
import { resumeSession } from '@/lib/services/session-service';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { BarChart2 } from 'lucide-react';
import ChatInterface from '@/app/(chat)/_components/chat-interface';

export default async function SessionChatPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const supabaseAdmin = getSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginPath(`/chat/${sessionId}`));
  }

  // 1. 세션 존재 여부 및 소유권 확인
  const { data: session, error: sessionError } = (await supabaseAdmin
    .from('tutoring_sessions')
    .select('id, student_id, session_status, problem_hash, extracted_text')
    .eq('id', sessionId)
    .maybeSingle()) as { data: { id: string; student_id: string; session_status: string; problem_hash: string; extracted_text: string } | null; error: any };

  if (sessionError) {
    console.error('[chat/[sessionId]] 세션 조회 실패:', {
      sessionId,
      userId: user.id,
      error: sessionError.message,
    });
    redirect('/chat/new');
  }

  if (!session) {
    console.warn('[chat/[sessionId]] 세션을 찾을 수 없음, 새 질문으로 이동:', {
      sessionId,
      userId: user.id,
    });
    redirect('/chat/new');
  }

  if (session.student_id !== user.id) {
    console.warn('[chat/[sessionId]] 다른 사용자 세션 접근 차단:', {
      sessionId,
      userId: user.id,
      ownerId: session.student_id,
    });
    notFound();
  }

  let effectiveSessionStatus = session.session_status;

  // 2. 세션 상태를 in_progress로 복원 (abandoned에서 돌아온 경우)
  if (session.session_status === 'abandoned') {
    const result = await resumeSession(sessionId, { studentId: user.id });
    if (result.success) {
      effectiveSessionStatus = 'in_progress';
    }
  }

  // 3. dialogue_logs에서 대화 기록 패칭 (세션당 1줄 JSON)
  const { data: logRow } = await supabaseAdmin
    .from('dialogue_logs')
    .select('messages')
    .eq('session_id', sessionId)
    .single();

  // 4. Vercel AI SDK의 Message 형식으로 변환
  const messagesArray = (logRow?.messages as any[]) || [];
  const initialMessages = messagesArray.map((msg: any, i: number) => ({
    id: `db-msg-${i}`,
    role: (msg.role === 'student' || msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: msg.content }],
  }));

  return (
    <div className="flex flex-col h-full">
      {/* completed 세션일 때만 리포트 버튼 표시 */}
      {effectiveSessionStatus === 'completed' && (
        <div className="flex items-center justify-end px-4 py-2 border-b border-zinc-100 bg-white shrink-0">
          <Link
            href={`/chat/${sessionId}/report`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs font-semibold rounded-lg transition-colors"
          >
            <BarChart2 size={13} />
            세션 리포트 보기
          </Link>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ChatInterface
          key={sessionId}
          sessionId={sessionId}
          initialMessages={initialMessages}
          extractedText={session.extracted_text}
          initialSessionStatus={effectiveSessionStatus}
        />
      </div>
    </div>
  );
}
