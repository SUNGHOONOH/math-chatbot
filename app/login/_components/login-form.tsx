'use client';

import { useState } from 'react';
import { sanitizeRedirectPath } from '@/lib/auth';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Loader2, Mail } from 'lucide-react';

interface LoginFormProps {
  nextPath?: string;
}

export default function LoginForm({ nextPath = '/' }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const safeNextPath = sanitizeRedirectPath(nextPath);

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
          window.location.href = safeNextPath;
        }
      } else {
        setError(error.message);
      }
    } else {
      window.location.href = safeNextPath;
    }
    setLoading(false);
  };

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {

    setLoading(true);
    setError(null);
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (safeNextPath !== '/') {
      callbackUrl.searchParams.set('next', safeNextPath);
    }

    const { error } = await supabaseBrowser.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl shadow-zinc-200 border border-zinc-100 p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-cyan-500 bg-clip-text text-transparent">
          AHA Tutor 시작하기
        </h1>
        <p className="text-sm text-zinc-500 mt-2">나만의 소크라틱 AI 수학 선생님</p>
        {safeNextPath !== '/' && (
          <p className="text-xs text-zinc-400 mt-1">로그인 후 원래 보던 화면으로 돌아갑니다.</p>
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
          className="w-full flex items-center justify-center gap-2 bg-[#FEE500] hover:bg-[#FEE500]/90 text-black font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          카카오로 시작하기
        </button>

        <button
          onClick={() => handleOAuthLogin('google')}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
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

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-zinc-400"
          />
        </div>
        <div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-zinc-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white font-medium py-3 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Mail className="w-4 h-4" />}
          로그인 / 자동 회원가입
        </button>
      </form>
    </div>
  );
}
