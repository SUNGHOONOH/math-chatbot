import { redirect } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { buildLoginPath, buildOnboardingPath } from '@/lib/auth';
import { getUserProfileSetupState } from '@/lib/user-profile';
import { StudentNav } from './_components/student-nav';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginPath('/dashboard'));
  }

  const profileState = await getUserProfileSetupState(supabase, user.id);

  if (!profileState.isComplete) {
    redirect(buildOnboardingPath('/dashboard'));
  }

  const displayName = profileState.nickname || user.email?.split('@')[0] || '학생';

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden overscroll-x-none bg-zinc-50 text-zinc-900">
      <header className="safe-top sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Student Space
                </p>
                <h1 className="truncate text-lg font-semibold text-zinc-900">
                  {displayName}님의 학습 공간
                </h1>
              </div>
            </div>
          </div>
          <StudentNav />
        </div>
      </header>

      <main className="safe-bottom mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
