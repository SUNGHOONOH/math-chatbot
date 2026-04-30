'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import {
  ArrowRight,
  BarChart3,
  Camera,
  FileText,
  Loader2,
  Menu,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';

function isNativeAppRuntime() {
  return Capacitor.isNativePlatform();
}

export function NativeAppLanding({ forceVisible = false }: { forceVisible?: boolean }) {
  const router = useRouter();
  const [isNative, setIsNative] = useState(forceVisible);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const native = forceVisible || isNativeAppRuntime();
    setIsNative(native);
    if (!native) return;

    let cancelled = false;

    void supabaseBrowser.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setIsLoggedIn(Boolean(data.user));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [forceVisible]);

  if (!isNative) return null;

  const goPrimary = () => {
    if (isLoggedIn === null) return;
    router.push(isLoggedIn ? '/chat/new' : '/login?next=/chat/new');
  };

  return (
    <main className="fixed inset-0 z-[100] flex w-screen max-w-[100vw] flex-col overflow-hidden overscroll-x-none bg-[#f7f8f6] text-zinc-950">
      <div className="native-screen-pad flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-x-none px-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 shadow-sm">
              <img src="/icon.png" alt="AHA Tutor" className="h-8 w-8 rounded-xl invert" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold">AHA Tutor</p>
              <p className="truncate text-xs font-medium text-zinc-500">정답보다 먼저, 다음 생각</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-900 shadow-sm"
            aria-label="앱 메뉴 열기"
          >
            <Menu size={20} />
          </button>
        </header>

        <section className="flex flex-1 flex-col justify-center space-y-5 py-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
              <Sparkles size={13} />
              앱에서 바로 시작
            </div>
            <h1 className="text-[34px] font-bold leading-[1.06] tracking-normal text-zinc-950">
              사진 찍고,
              <br />
              막힌 지점부터.
            </h1>
            <p className="max-w-sm text-[15px] leading-6 text-zinc-600">
              긴 설명 대신 지금 필요한 질문 하나로 풀이를 다시 움직이게 합니다.
            </p>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Camera size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-950">문제를 찍으면 바로 대화가 시작됩니다.</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  사진, PDF, 풀이 과정을 올리고 막힌 부분만 말하세요.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-zinc-50 px-3 py-2.5">
                <p className="text-[11px] font-bold text-zinc-400">Tutor</p>
                <p className="mt-1 text-xs font-semibold text-zinc-800">정답 대신 질문</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 px-3 py-2.5">
                <p className="text-[11px] font-bold text-zinc-400">Report</p>
                <p className="mt-1 text-xs font-semibold text-zinc-800">막힌 개념 기록</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="space-y-3">
          <button
            type="button"
            onClick={goPrimary}
            disabled={isLoggedIn === null}
            className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3.5 text-[16px] font-bold text-white shadow-lg shadow-zinc-900/15 active:scale-[0.99] disabled:opacity-70"
          >
            {isLoggedIn === null ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                준비 중
              </>
            ) : (
              <>
                {isLoggedIn ? '새 문제 시작하기' : '로그인하고 시작하기'}
                <ArrowRight size={19} />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push('/teachers')}
            className="min-h-11 w-full rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 shadow-sm active:scale-[0.99]"
          >
            선생님용 AHA 보기
          </button>
        </footer>
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 z-[110] bg-black/40" onClick={() => setIsMenuOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-[120] w-[82vw] max-w-[320px] transform overflow-hidden overscroll-x-none border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="native-screen-pad flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold text-white">
                A
              </div>
              <span className="truncate text-base font-bold text-zinc-950">AHA Tutor</span>
            </div>
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
              aria-label="앱 메뉴 닫기"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-2 p-4">
            <button
              type="button"
              onClick={goPrimary}
              disabled={isLoggedIn === null}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-zinc-950 px-4 text-sm font-bold text-white disabled:opacity-70"
            >
              {isLoggedIn === null ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              {isLoggedIn === null ? '준비 중' : isLoggedIn ? '새 문제 시작하기' : '로그인하고 시작하기'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-zinc-50 px-4 text-sm font-semibold text-zinc-800"
            >
              <BarChart3 size={18} />
              학습 대시보드
            </button>
            <button
              type="button"
              onClick={() => router.push('/teachers')}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-zinc-50 px-4 text-sm font-semibold text-zinc-800"
            >
              <FileText size={18} />
              선생님용 AHA
            </button>
          </nav>

          <div className="mt-auto border-t border-zinc-200 p-4">
            <p className="text-xs leading-5 text-zinc-500">
              로그인하면 대화 기록과 리포트를 앱 사이드바에서 이어서 확인할 수 있습니다.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
