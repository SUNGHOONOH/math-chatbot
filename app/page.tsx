import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  MessageCircleQuestion,
  Upload,
  Zap,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { HeroChatInput } from './_components/hero-chat-input';

export const metadata = {
  title: 'AHA — 정답을 주지 않는 AI 수학 튜터',
  description:
    'AHA는 한국 고등학생을 위한 소크라틱 AI 수학 튜터입니다. 정답 대신 질문으로 풀이를 이끌고, 세션 리포트로 막힌 개념을 보여줍니다.',
};

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <main className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-emerald-100">
      {/* Navigation */}
      <header className="fixed inset-x-0 top-0 z-40 bg-white/70 backdrop-blur-md border-b border-zinc-100">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <div className="bg-emerald-600 px-2 py-1 rounded-lg flex items-center justify-center shadow-md shadow-emerald-600/20">
              <span className="text-white font-black text-xs leading-none tracking-wider">AHA</span>
            </div>
            <span className="text-base font-bold tracking-tight text-zinc-900">AHA Tutor</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/teachers"
              className="hidden px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors sm:inline-flex"
            >
              선생님용
            </Link>
            {!isLoggedIn ? (
              <>
                <Link
                  href="/login?next=/chat/new"
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  로그인
                </Link>
                <Link
                  href="/login?next=/chat/new"
                  className="bg-zinc-900 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-zinc-800 transition-all active:scale-95"
                >
                  시작하기
                </Link>
              </>
            ) : (
              <Link
                href="/dashboard"
                className="bg-emerald-600 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-emerald-500 transition-all active:scale-95 shadow-md shadow-emerald-600/20"
              >
                나의 대시보드
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* Hero Section (Qanda Inspired) */}
      <section className="relative pt-44 pb-32 overflow-hidden">
        {/* Subtle Background Pattern - Fixed spacing in bracket */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,var(--tw-gradient-stops))] from-emerald-50/50 via-white to-white" />

        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center text-center">
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="mb-8 inline-flex items-center justify-center px-5 py-2 rounded-full bg-emerald-50 text-sm font-bold text-emerald-700 border border-emerald-100 shadow-sm backdrop-blur-sm">
              답 보기 전에, 내가 어디서 멈췄는지 먼저
            </p>
            <h1 className="text-[48px] md:text-[64px] font-black text-zinc-900 tracking-tighter leading-tight">
              <span className="text-emerald-600">AHA</span>는 정답을<br className="md:hidden" /> 주지 않습니다.
            </h1>
            <p className="mt-8 text-lg md:text-xl text-zinc-500 max-w-xl mx-auto leading-relaxed font-medium">
              문제를 풀다 멈춘 순간, AHA는 바로 풀이를 보여주지 않습니다.<br className="hidden md:block" />
              지금 이어갈 수 있는 질문 하나를 던지고, 어디서 사고가 멈췄는지 리포트로 기록합니다.
            </p>
          </div>

          <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
            <HeroChatInput isLoggedIn={isLoggedIn} />
          </div>

          <div className="mt-16 flex flex-wrap justify-center gap-x-12 gap-y-6 animate-in fade-in duration-1000 delay-500">
            <div className="flex flex-col items-center">
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">학습 방식</span>
              <span className="text-xl font-bold text-zinc-900">정답 대신 질문</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">리포트 핵심</span>
              <span className="text-xl font-bold text-zinc-900">막힌 사고 단계</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">도움이 필요한 순간</span>
              <span className="text-xl font-bold text-zinc-900">풀이 중간에 막힐 때</span>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-32 bg-zinc-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-20 text-center md:text-left">
            <h2 className="text-[48px] md:text-[64px] font-black text-zinc-900 tracking-tighter leading-tight">
              해설을 보면 이해한 것 같은데,<br className="hidden md:block" /> <span className="text-emerald-600">다음 문제에서 또 막힙니다.</span>
            </h2>
            <p className="mt-6 text-lg md:text-xl text-zinc-500 max-w-2xl leading-relaxed font-medium">
              답을 빨리 보는 건 쉽지만, 다음에 비슷한 문제를 만나면 또 같은 지점에서 멈출 수 있습니다.
              AHA는 풀이 대화 속에서 내가 어디서 생각을 멈췄는지 기록합니다.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="group bg-white p-8 rounded-[32px] border border-zinc-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform">
                <Upload size={22} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-3">문제 업로드</h3>
              <p className="text-zinc-500 leading-relaxed text-[15px]">
                사진, PDF, 직접 입력으로 막힌 문제를 올립니다. 처음부터 다시 설명하지 않아도 바로 풀이 흐름을 시작할 수 있습니다.
              </p>
            </div>

            <div className="group bg-white p-8 rounded-[32px] border border-zinc-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform shadow-lg shadow-emerald-600/20">
                <MessageCircleQuestion size={22} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-3">답 대신 질문 받기</h3>
              <p className="text-zinc-500 leading-relaxed text-[15px]">
                정답 대신 지금 이어갈 수 있는 질문 하나를 던집니다. 답을 보기 전에 한 단계만 더 생각하게 합니다.
              </p>
            </div>

            <div className="group bg-white p-8 rounded-[32px] border border-zinc-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 bg-amber-400 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform">
                <BarChart3 size={22} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-3">내가 멈춘 지점 확인하기</h3>
              <p className="text-zinc-500 leading-relaxed text-[15px]">
                세션이 끝나면 막힌 사고 단계와 스스로 해결한 지점이 남습니다. 기록이 쌓일수록 내 약점이 선명해집니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlight */}
      <section className="py-32 bg-white">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
              <Zap size={12} className="fill-current" />
              Thinking Diagnosis
            </div>
            <h2 className="text-[42px] md:text-[64px] font-black text-zinc-900 tracking-tighter leading-tight">
              중요한 건 틀린 문제가 아니라,<br /> <span className="text-emerald-600">어디서 생각이 멈췄는지</span>입니다.
            </h2>
            <div className="space-y-6">
              {[
                '정답을 바로 보여주지 않는 소크라틱 튜터링',
                '풀이 중간에 멈춘 사고 단계 기록',
                '반복적으로 약한 지점을 확인하는 학습 대시보드',
                '선생님이 옆에 없어도 혼자 공부할 때 질문 가능'
              ].map((text) => (
                <div key={text} className="flex items-start gap-5">
                  <div className="mt-1 bg-emerald-50 border border-emerald-100 rounded-full p-1.5 shadow-sm">
                    <CheckCircle2 size={16} className="text-emerald-600" strokeWidth={2.5} />
                  </div>
                  <p className="text-lg md:text-xl text-zinc-800 font-semibold tracking-tight">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="bg-zinc-50 rounded-[40px] border border-zinc-200 shadow-2xl overflow-hidden">
              {/* Browser Top Bar */}
              <div className="h-12 bg-white border-b border-zinc-100 flex items-center px-6 gap-2">
                <div className="w-3 h-3 rounded-full bg-zinc-200" />
                <div className="w-3 h-3 rounded-full bg-zinc-200" />
                <div className="w-3 h-3 rounded-full bg-zinc-200" />
              </div>

              <div className="p-8 space-y-8">
                {/* Chat Preview */}
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  <div className="flex flex-col items-end">
                    <div className="bg-zinc-900 text-white px-4 py-2.5 rounded-2xl rounded-tr-none text-sm font-medium shadow-sm max-w-[85%]">
                      이차함수 최대최소 구하는 것부터 막혀요.
                    </div>
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 bg-emerald-600 rounded-md flex items-center justify-center shadow-sm">
                        <span className="text-[8px] font-black text-white tracking-wider">AHA</span>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">AHA Tutor</span>
                    </div>
                    <div className="bg-white border border-emerald-200 text-zinc-900 px-4 py-2.5 rounded-2xl rounded-tl-none text-sm font-medium shadow-sm max-w-[85%] leading-relaxed">
                      좋아요. 그럼 식에서 <span className="text-emerald-600 font-bold">완전제곱식</span>으로 바꿀 수 있는 부분이 있는지 먼저 찾아볼까요?
                    </div>
                  </div>
                </div>

                {/* Path Preview */}
                <div className="bg-white rounded-3xl border border-zinc-100 p-5 shadow-sm animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-zinc-950 rounded-md flex items-center justify-center">
                        <BarChart3 size={12} className="text-white" />
                      </div>
                      <span className="text-xs font-bold text-zinc-900">분석 결과: 나의 사고 경로</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Success</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Stuck</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[11px] font-bold text-emerald-600">01</div>
                      <div className="flex-1 h-1.5 bg-emerald-100 rounded-full" />
                      <span className="text-[11px] font-bold text-emerald-700">해석 완료</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-[11px] font-bold text-red-500">02</div>
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="w-[40%] h-full bg-red-400" />
                      </div>
                      <span className="text-[11px] font-bold text-red-600 underline underline-offset-4 decoration-red-200">여기서 멈춤</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f4f7fb] py-20 border-y border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-black text-blue-600 mb-4 tracking-wider uppercase">선생님·학원용</p>
            <h2 className="text-[32px] md:text-[48px] font-black text-zinc-900 tracking-tighter leading-tight">
              학생이 어디서 멈췄는지,<br className="hidden md:block" /> <span className="text-emerald-600">수업 전에 확인하세요.</span>
            </h2>
            <p className="mt-6 text-lg text-zinc-500 leading-relaxed font-medium">
              AHA는 학생의 풀이 대화에서 막힌 사고 단계를 기록합니다. 선생님은 학생별로 자주
              멈추는 지점을 보고, 다음 수업에서 어디를 짚어야 할지 더 빨리 파악할 수 있습니다.
            </p>
          </div>
          <Link
            href="/teachers"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50"
          >
            수업용 AHA 보기
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer / CTA */}
      <footer className="bg-zinc-950 py-24 text-white text-center overflow-hidden relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-linear-to-r from-transparent via-zinc-800 to-transparent" />
        <div className="max-w-2xl mx-auto px-6 relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-8">
            오늘 막힌 문제부터<br /> 시작해보세요.
          </h2>
          <Link
            href="/chat/new"
            className="inline-flex items-center gap-2 bg-white text-zinc-950 px-8 py-4 rounded-full font-bold text-lg hover:bg-zinc-100 transition-all hover:scale-105 active:scale-95"
          >
            막힌 문제 이어서 풀기
            <ArrowRight size={20} />
          </Link>
          <div className="mt-16 flex justify-center gap-8 text-zinc-500 text-sm font-medium">
            <Link href="#" className="hover:text-white transition-colors">개인정보처리방침</Link>
            <Link href="#" className="hover:text-white transition-colors">이용약관</Link>
            <Link href="#" className="hover:text-white transition-colors">문의하기</Link>
          </div>
          <p className="mt-12 text-zinc-600 text-xs font-medium uppercase tracking-[0.2em]">
            © 2026 AHA Tutor. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
