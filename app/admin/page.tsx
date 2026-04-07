import { getSupabaseAdmin } from '@/lib/supabase/client';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = getSupabaseAdmin();

  // ── 통계 집계 ──
  const { count: totalSessions } = await supabase
    .from('tutoring_sessions')
    .select('*', { count: 'exact', head: true });

  const { count: totalBottlenecks } = await supabase
    .from('learning_bottlenecks')
    .select('*', { count: 'exact', head: true });

  const { count: totalReports } = await supabase
    .from('session_reports')
    .select('*', { count: 'exact', head: true });

  const { count: totalConceptNodes } = await supabase
    .from('concept_nodes_reference')
    .select('*', { count: 'exact', head: true });

  const { count: nullEmbeddingCount } = await supabase
    .from('concept_nodes_reference')
    .select('*', { count: 'exact', head: true })
    .is('embedding', null);

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">관리자 대시보드</h1>
          <p className="text-zinc-500 mt-2 text-sm">전체 세션, 병목 감지, 진단 보고서 통계를 한눈에 파악합니다.</p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-medium rounded-xl transition-all border border-zinc-200 flex items-center gap-2"
        >
          🏠 홈으로
        </Link>
      </header>

      {/* ── 통계 카드 ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <h3 className="text-zinc-500 text-sm font-medium">총 세션 수</h3>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{totalSessions || 0}</p>
          <Link href="/admin/sessions" className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
            세션 상세 보기
          </Link>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <h3 className="text-zinc-500 text-sm font-medium">감지된 병목</h3>
          <p className="text-3xl font-bold text-rose-600 mt-2">{totalBottlenecks || 0}</p>
          <Link href="/admin/sessions" className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
            대화 품질 보기
          </Link>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <h3 className="text-zinc-500 text-sm font-medium">진단 보고서</h3>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{totalReports || 0}</p>
          <Link href="/admin/sessions" className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
            리포트 흐름 보기
          </Link>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <h3 className="text-zinc-500 text-sm font-medium">개념 노드 수</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{totalConceptNodes || 0}</p>
          <Link href="/admin/labeling" className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
            노드/문제 은행 관리
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Link
          href="/admin/labeling"
          className="block bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 hover:border-blue-200 hover:shadow-md transition-all"
        >
          <h2 className="text-lg font-bold text-zinc-900">라벨링 · 문제 은행</h2>
          <p className="text-sm text-zinc-500 mt-2">
            개념 노드 임포트, 임베딩 생성, 전략 그래프 검수와 문제 은행 관리를 한 곳으로 모았습니다.
          </p>
          <div className="mt-5 flex items-center gap-4 text-sm">
            <span className="text-zinc-600">개념 노드 {totalConceptNodes || 0}개</span>
            <span className={`font-medium ${(nullEmbeddingCount || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              임베딩 대기 {nullEmbeddingCount || 0}개
            </span>
          </div>
        </Link>

        <Link
          href="/admin/sessions"
          className="block bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 hover:border-blue-200 hover:shadow-md transition-all"
        >
          <h2 className="text-lg font-bold text-zinc-900">세션 · 최근 대화 로그</h2>
          <p className="text-sm text-zinc-500 mt-2">
            세션 상태, 최근 대화 로그, 병목 기록, 보고서 흐름을 세션 단위로 조회합니다.
          </p>
          <div className="mt-5 flex items-center gap-4 text-sm text-zinc-600">
            <span>세션 {totalSessions || 0}개</span>
            <span>병목 {totalBottlenecks || 0}개</span>
            <span>리포트 {totalReports || 0}개</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
