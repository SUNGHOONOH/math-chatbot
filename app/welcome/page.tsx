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
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.2),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_28%),linear-gradient(180deg,#fafaf9_0%,#f8fafc_48%,#eef2ff_100%)]">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="flex flex-col justify-between rounded-4xl border border-white/70 bg-white/80 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur md:p-10">
          <div className="space-y-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              <Sparkles size={14} />
              AHA 시작하기
            </div>

            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl">
                막힌 문제를 이어 풀기 전에, 딱 한 가지만 설정해요.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-600 md:text-lg">
                AHA가 당신을 어떻게 부르면 좋을지, 그리고 어느 학년 수준으로 설명하면 좋을지만 알려주세요.
                설정이 끝나면 바로 문제 풀이 화면으로 돌아갑니다.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white">
                  <Rocket size={18} />
                </div>
                <h2 className="text-sm font-semibold text-zinc-900">바로 문제로 돌아가기</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  프로필은 짧게 끝내고, 방금 막혔던 문제 풀이를 이어갈 수 있게 합니다.
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 text-white">
                  <Target size={18} />
                </div>
                <h2 className="text-sm font-semibold text-zinc-900">막힌 지점 기록</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  대화 중 어디서 생각이 멈췄는지 확인해, 세션 리포트에 남깁니다.
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                  <Sparkles size={18} />
                </div>
                <h2 className="text-sm font-semibold text-zinc-900">약점 확인</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  기록이 쌓이면 내가 자주 멈추는 사고 단계를 더 선명하게 볼 수 있습니다.
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
