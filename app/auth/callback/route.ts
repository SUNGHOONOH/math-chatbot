import { NextResponse } from 'next/server';
import { DEFAULT_POST_ONBOARDING_PATH, LOGIN_PATH, buildOnboardingPath, sanitizeRedirectPath } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getUserProfileSetupState } from '@/lib/user-profile';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeRedirectPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const profileState = await getUserProfileSetupState(supabase, user.id);

        if (!profileState.isComplete) {
          const onboardingPath = buildOnboardingPath(
            next === '/' ? DEFAULT_POST_ONBOARDING_PATH : next
          );
          return NextResponse.redirect(`${origin}${onboardingPath}`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 오류가 났거나 code가 없는 경우 로그인 화면으로 돌려보냄
  return NextResponse.redirect(`${origin}${LOGIN_PATH}`);
}
