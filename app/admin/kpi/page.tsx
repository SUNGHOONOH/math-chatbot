export default function KPIPage() {
  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">KPI 대시보드</h1>
          <p className="text-zinc-500 mt-2 text-sm max-w-lg">
            파일럿 테스트(검정고시 준비생 10~20명)를 통한 실제 학습 효과와 지표를 추적합니다.
          </p>
        </div>
        <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md font-bold uppercase tracking-wider">
          Phase 3 Target
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm border-b-4 border-b-blue-500">
          <h3 className="text-sm font-semibold text-zinc-500">학습 성취도 향상</h3>
          <p className="text-3xl font-bold mt-2 text-zinc-900">-%</p>
          <p className="text-xs text-zinc-400 mt-1">데이터 축적 중...</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-500">질문당 사고 시간</h3>
          <p className="text-3xl font-bold mt-2 text-zinc-900">0s</p>
          <p className="text-xs text-zinc-400 mt-1">평균 응답 지연</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-500">AHA Moment 빈도</h3>
          <p className="text-3xl font-bold mt-2 text-zinc-900">0.0</p>
          <p className="text-xs text-zinc-400 mt-1">세션당 평균</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-500">이탈 방지 개입</h3>
          <p className="text-3xl font-bold mt-2 text-zinc-900">0%</p>
          <p className="text-xs text-zinc-400 mt-1">동적 넛지 발동률</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-400 italic shadow-sm">
        파일럿 대상자 그룹 데이터가 적재되면 상세 차트가 활성화됩니다.
      </div>
    </div>
  );
}
