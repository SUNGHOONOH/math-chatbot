// ============================================================
// AHA v5 — (chat) Route Group Layout
// ============================================================
// 사이드바 + 메인 콘텐츠 영역을 배치합니다.
// ============================================================

import Sidebar from '@/app/(chat)/_components/sidebar/sidebar';
import { getSidebarSessions } from '@/app/(chat)/_components/sidebar/session-list';
import { createClient } from '@/lib/supabase/server';
import { buildLoginPath, buildOnboardingPath, isUserAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserProfileSetupState } from '@/lib/user-profile';

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginPath('/chat/new'));
  }

  const profileState = await getUserProfileSetupState(supabase, user.id);

  if (!profileState.isComplete) {
    redirect(buildOnboardingPath('/chat/new'));
  }

  // 세션 목록 및 관리자 여부 가져오기
  const sessions = await getSidebarSessions() || [];
  const isAdmin = isUserAdmin(user);

  return (
    <div className="flex h-[100dvh] w-full max-w-[100vw] overflow-hidden overscroll-x-none bg-zinc-50">
      <Sidebar sessions={sessions} isAdmin={isAdmin} />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden overscroll-x-none">{children}</main>
    </div>
  );
}
