import { BarChart2, Loader2 } from 'lucide-react';

export default function ReportLoading() {
  return (
    <div className="safe-top safe-bottom flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-50 px-5">
      <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center">
        <BarChart2 size={24} className="text-emerald-500" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-zinc-800 text-sm">리포트를 생성하고 있어요</p>
        <p className="text-xs text-zinc-400 mt-1">대화 내용을 분석 중입니다. 잠시만 기다려 주세요.</p>
      </div>
      <Loader2 size={20} className="text-emerald-400 animate-spin" />
    </div>
  );
}
