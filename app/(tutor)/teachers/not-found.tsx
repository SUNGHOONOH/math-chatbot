import Link from 'next/link';
import { ArrowLeft, MessageCircleQuestion } from 'lucide-react';

export default function TeachersNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5 py-16 text-zinc-950">
      <section className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm md:p-10">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <MessageCircleQuestion size={22} />
        </div>
        <p className="text-sm font-semibold text-blue-700">404 · 준비 중</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-zinc-950">
          선생님·학원용 페이지는 아직 준비 중입니다.
        </h1>
        <p className="mt-4 text-sm leading-7 text-zinc-600">
          지금은 학생용 AHA부터 사용할 수 있습니다. 선생님용 진단 리포트와 수업 운영 기능은
          별도 페이지로 정리해 열 예정입니다.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          <ArrowLeft size={16} />
          랜딩 페이지로 돌아가기
        </Link>
      </section>
    </main>
  );
}
