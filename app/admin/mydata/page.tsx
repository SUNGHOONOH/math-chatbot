export default function MyDataPage() {
  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">MyData 관리</h1>
        <p className="text-zinc-500 mt-2 text-sm max-w-lg">
          학생 개개인이 본인의 학습 이력 및 사고 로그 데이터 주권을 가질 수 있도록 지원하는 관리 도구입니다.
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-500 shadow-sm border-dashed">
        💡 데이터 주권 서비스 구축 중 (Phase 5+)
      </div>
    </div>
  );
}
