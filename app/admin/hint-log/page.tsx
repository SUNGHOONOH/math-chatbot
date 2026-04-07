export default function HintLogPage() {
  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">풀이 버튼 분석</h1>
        <p className="text-zinc-500 mt-2 text-sm">
          학생들이 어떤 단계에서 병목(Wheel-spinning)을 느끼고 &apos;전체 풀이 보기&apos;를 눌렀는지 분석합니다.
          <br />병목 개념, 미해결 비율, 세션 종료 상태를 기준으로 힌트의 적절성을 검증합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-sm font-medium text-zinc-500">전체 풀이 클릭률</h3>
          <p className="text-3xl font-bold mt-2 text-zinc-900">12.4%</p>
          <p className="text-xs text-green-600 mt-1">지난주 대비 2.1% 감소 ▼</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-sm font-medium text-zinc-500">평균 힌트 노출 수</h3>
          <p className="text-3xl font-bold mt-2 text-zinc-900">4.2개</p>
          <p className="text-xs text-zinc-400 mt-1">세션당 평균</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-sm font-medium text-zinc-500">최다 병목 노드</h3>
          <p className="text-3xl font-bold mt-2 text-zinc-900">IR_021_004</p>
          <p className="text-xs text-amber-600 mt-1">응답 지연 발생 중</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-500 shadow-sm">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-xl">📊</span>
          </div>
          <p className="font-medium text-zinc-900">상세 로그 분석 데이터 준비 중</p>
          <p className="text-sm">Vercel AI SDK와 Supabase를 연동하여 실시간 클릭 이벤트를 수집할 예정입니다.</p>
        </div>
      </div>
    </div>
  );
}
