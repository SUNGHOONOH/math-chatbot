export default function LabelingPage() {
  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">라벨링 검수 큐</h1>
          <p className="text-zinc-500 mt-2 text-sm max-w-2xl">
            GPT-4o가 실시간으로 생성한 <span className="text-blue-600 font-semibold font-mono">llm_generated</span> 전략 그래프와 5덩어리 데이터를 검토합니다.
            <br />튜터가 승인(Verify)한 데이터만 <span className="text-green-600 font-semibold font-mono">human_verified</span> 상태로 전환되며 향후 Fine-tuning 데이터셋으로 사용됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-center">
            <span className="text-xs text-amber-600 font-bold block">검토 대기</span>
            <span className="text-xl font-bold text-amber-700">24</span>
          </div>
          <div className="bg-green-50 border border-green-200 px-4 py-2 rounded-xl text-center">
            <span className="text-xs text-green-600 font-bold block">오늘 승인</span>
            <span className="text-xl font-bold text-green-700">12</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col items-center justify-center text-center p-12">
        <div className="max-w-md space-y-4">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">🏷️</span>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900">검토할 큐가 비어있습니다</h3>
          <p className="text-zinc-500 text-sm">
            현재 모든 <span className="font-mono text-xs bg-zinc-100 px-1 rounded">llm_generated</span> 세션이 검토 완료되었습니다.
            새로운 실시간 대화 데이터가 들어오면 여기에 자동으로 등록됩니다.
          </p>
          <button className="mt-4 px-6 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors">
            강제 새로고침
          </button>
        </div>
      </div>
    </div>
  );
}
