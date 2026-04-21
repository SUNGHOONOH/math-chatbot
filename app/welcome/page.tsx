import { redirect } from 'next/navigation';
import { Rocket, Sparkles, Target } from 'lucide-react';
import {
  DEFAULT_POST_ONBOARDING_PATH,
  buildLoginPath,
  sanitizeRedirectPath,
} from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getAvailableStudentNickname, getUserProfileSetupState } from '@/lib/user-profile';
import { WelcomeOnboardingForm } from './_components/welcome-onboarding-form';

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = sanitizeRedirectPath(next);
  const redirectTarget = nextPath === '/' ? DEFAULT_POST_ONBOARDING_PATH : nextPath;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginPath(`/welcome?next=${encodeURIComponent(redirectTarget)}`));
  }

  const profileState = await getUserProfileSetupState(supabase, user.id);

  if (profileState.isComplete) {
    redirect(redirectTarget);
  }

  const suggestedNickname = profileState.nickname || await getAvailableStudentNickname(supabase);

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.2),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_#fafaf9_0%,_#f8fafc_48%,_#eef2ff_100%)]">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="flex flex-col justify-between rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur md:p-10">
          <div className="space-y-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              <Sparkles size={14} />
              Welcome to AHA
            </div>

            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl">
                학습 공간에 들어가기 전에, 당신의 이름표부터 정합니다.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-600 md:text-lg">
                첫 프로필은 단순한 설정이 아니라, 앞으로의 성장 기록을 묶는 시작점입니다.
                여기서 정한 이름은 대시보드, 리포트, 이후의 배지나 성장 기록에도 이어집니다.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white">
                  <Rocket size={18} />
                </div>
                <h2 className="text-sm font-semibold text-zinc-900">첫 진입 설계</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  학생이 어떤 이름으로 학습할지 초기에 고정해, 이후 리포트와 경험치를 안정적으로 이어갑니다.
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 text-white">
                  <Target size={18} />
                </div>
                <h2 className="text-sm font-semibold text-zinc-900">학습 데이터 동의</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  병목 진단과 세션 리포트를 만들기 위해 필요한 범위에서 대화 데이터를 활용합니다.
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                  <Sparkles size={18} />
                </div>
                <h2 className="text-sm font-semibold text-zinc-900">확장 가능성</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  이후 레벨, 배지, 학습 streak가 붙어도 이 프로필을 기준으로 무리 없이 확장할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <WelcomeOnboardingForm
            initialEmail={user.email ?? ''}
            initialNickname={suggestedNickname}
            initialGradeLevel={profileState.gradeLevel}
            nextPath={redirectTarget}
          />
        </section>
      </div>
    </div>
  );
}
