// ============================================================
// AHA v5 — (chat) Route Group Layout
// ============================================================
// 사이드바 + 메인 콘텐츠 영역을 배치합니다.
// ============================================================

import Sidebar from '@/app/(chat)/_components/sidebar/sidebar';
import { getSidebarSessions } from '@/app/(chat)/_components/sidebar/session-list';
import { createClient } from '@/lib/supabase/server';
import { isUserAdmin } from '@/lib/auth';

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 세션 목록 및 관리자 여부 가져오기
  const sessions = await getSidebarSessions() || [];
  const isAdmin = isUserAdmin(user);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar sessions={sessions} isAdmin={isAdmin} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
