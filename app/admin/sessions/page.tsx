export default function SessionsPage() {
  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">대화 세션 조회</h1>
        <p className="text-zinc-500 mt-2 text-sm">
          onSessionEnd() 함수로 저장된 원문 대화(검증 DB)와 분해된 5덩어리 데이터(운영 DB)를 조회합니다.
          <br />GPT-4o가 생성한 소크라틱 대화의 품질을 모니터링하고 라벨링 데이터를 추출합니다.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-600">전체 세션</span>
            <span className="px-3 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-400">검토 필요</span>
          </div>
          <div className="text-xs text-zinc-400 font-mono tracking-tighter">
            STORAGE v5 INTEGRATED
          </div>
        </div>

        <div className="p-12 text-center text-zinc-500">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <span className="text-xl">🗨️</span>
            </div>
            <p className="font-medium text-zinc-900">최근 대화 기록이 여기에 표시됩니다.</p>
            <p className="text-sm">세션별 node_posterior 확률 분포와 OCR 원본 이미지를 함께 불러옵니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
