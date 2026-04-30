'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { sanitizeRedirectPath } from '@/lib/auth';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';

interface LoginFormProps {
  nextPath?: string;
}

export default function LoginForm({ nextPath = '/' }: LoginFormProps) {
  const router = useRouter();
  const isNativeApp = Capacitor.isNativePlatform();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const safeNextPath = sanitizeRedirectPath(nextPath);

  useEffect(() => {
    if (!isNativeApp) return;

    const handleNativeOAuthCallback = async ({ url }: { url: string }) => {
      const callbackUrl = new URL(url);
      const isAhaCallback =
        callbackUrl.protocol === 'com.aha.v5:' &&
        callbackUrl.host === 'auth' &&
        callbackUrl.pathname === '/callback';

      console.info('[auth] native appUrlOpen:', url);

      if (!isAhaCallback) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const code = callbackUrl.searchParams.get('code');
        const errorDescription = callbackUrl.searchParams.get('error_description') || callbackUrl.searchParams.get('error');
        const redirectTarget = sanitizeRedirectPath(callbackUrl.searchParams.get('next')) || safeNextPath;

        await Browser.close();

        if (errorDescription) {
          setError(errorDescription);
          return;
        }

        if (!code) {
          setError('로그인 인증 코드가 없습니다. 다시 시도해 주세요.');
          return;
        }

        const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message);
          return;
        }

        router.replace(redirectTarget);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : '소셜 로그인 처리 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    let removeListener: (() => void) | undefined;

    void CapacitorApp.addListener('appUrlOpen', handleNativeOAuthCallback).then((handle) => {
      removeListener = () => {
        void handle.remove();
      };
    });

    return () => {
      removeListener?.();
    };
  }, [isNativeApp, router, safeNextPath]);

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    router.replace(isNativeApp ? '/app' : '/');
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 계정이 없으면 자동 회원가입 시도 (MVP 시나리오)
      if (error.message.includes('Invalid login credentials')) {
        const { error: signUpError } = await supabaseBrowser.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
        } else {
          router.replace(safeNextPath);
        }
      } else {
        setError(error.message);
      }
    } else {
      router.replace(safeNextPath);
    }
    setLoading(false);
  };

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    setLoading(true);
    setError(null);
    const redirectTo = isNativeApp
      ? `com.aha.v5://auth/callback?next=${encodeURIComponent(safeNextPath)}`
      : (() => {
          const callbackUrl = new URL('/auth/callback', window.location.origin);
          if (safeNextPath !== '/') {
            callbackUrl.searchParams.set('next', safeNextPath);
          }
          return callbackUrl.toString();
        })();

    const { data, error } = await supabaseBrowser.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: isNativeApp,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (isNativeApp && data.url) {
      console.info('[auth] native OAuth URL:', data.url);
      await Browser.open({
        url: data.url,
        presentationStyle: 'fullscreen',
      });
      return;
    }

    setLoading(false);
  };

  return (
    <div className="w-full max-w-[420px] bg-white border border-zinc-200 shadow-xl shadow-zinc-200/70 p-5 sm:p-7 rounded-2xl">
      <div className="mb-6">
        <button
          type="button"
          onClick={handleBack}
          className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-50"
          aria-label="뒤로가기"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">AHA Tutor</p>
          <h1 className="text-[28px] font-bold leading-tight tracking-normal text-zinc-950">
            막힌 풀이를 이어갈 준비를 해볼까요?
          </h1>
          <p className="text-[15px] leading-6 text-zinc-500">
            문제 사진을 올리고, 정답 대신 다음 생각을 이끌어주는 AI 튜터와 시작하세요.
          </p>
        </div>
        {safeNextPath !== '/' && (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            로그인 후 보고 있던 화면으로 돌아갑니다.
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-[13px] text-center font-medium">
          {error}
        </div>
      )}

      <div className="space-y-3 mb-6">
        <button
          onClick={() => handleOAuthLogin('kakao')}
          disabled={loading}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-3 text-[15px] font-bold text-black transition-colors hover:bg-[#FEE500]/90 disabled:opacity-50"
        >
          카카오로 시작하기
        </button>

        <button
          onClick={() => handleOAuthLogin('google')}
          disabled={loading}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[15px] font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          구글로 시작하기
        </button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-zinc-400 font-medium">또는 이메일로 계속하기</span>
        </div>
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-3">
        <div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소"
            className="min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[16px] transition-all placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[16px] transition-all placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Mail className="w-4 h-4" />}
          로그인 / 자동 회원가입
        </button>
      </form>
    </div>
  );
}
