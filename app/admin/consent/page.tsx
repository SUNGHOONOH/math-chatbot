export default function ConsentPage() {
  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">동의 현황</h1>
        <p className="text-zinc-500 mt-2 text-sm">학생 정보 활용 동의서 및 마이데이터 서비스 이용 약관 체결 상태를 추적합니다.</p>
      </div>
      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-500 shadow-sm font-mono text-xs">
        💡 student_consent / data_privacy_v1_signed status [FETCHING...]
      </div>
    </div>
  );
}
