export default function UsersPage() {
  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">계정 관리</h1>
        <p className="text-zinc-500 mt-2 text-sm">
          학생 및 관리자 계정의 상태를 관리합니다. Phase 3 파일럿 대상자(10~20명) 권한 설정이 가능합니다.
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-500 shadow-sm">
        💡 계정 리스트 데이터 로딩 중 (Coming Soon)
      </div>
    </div>
  );
}
