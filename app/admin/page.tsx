import { getSupabaseAdmin } from '@/lib/supabase/admin';
import Link from 'next/link';
import { Database, BookOpen, Loader2 } from 'lucide-react';

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
          <Link href="/admin/labeling" className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
            병목 상태 보기 
          </Link>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <h3 className="text-zinc-500 text-sm font-medium">진단 보고서</h3>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{totalReports || 0}</p>
          <Link href="/admin/problems" className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
            전략 그래프 보기 
          </Link>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <h3 className="text-zinc-500 text-sm font-medium">개념 노드 수</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{totalConceptNodes || 0}</p>
          <Link href="/admin/knowledge" className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
            노드/문제 은행 관리
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Link
          href="/admin/labeling"
          className="block bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 hover:border-blue-200 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
            <Database size={20} />
          </div>
          <h2 className="text-lg font-bold text-zinc-900">AI 진단 라벨링 (교정)</h2>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            AI가 판단한 학생의 병목 지점을 검수하고, 잘못 매핑된 개념 코드를 수동으로 교정합니다.
          </p>
          <div className="mt-5 flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            <span>최근 병목 {totalBottlenecks || 0}건</span>
          </div>
        </Link>

        <Link
          href="/admin/knowledge"
          className="block bg-white rounded-2xl border border-blue-50 shadow-sm p-6 hover:border-emerald-200 hover:shadow-md transition-all ring-1 ring-emerald-50"
        >
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
            <BookOpen size={20} />
          </div>
          <h2 className="text-lg font-bold text-zinc-900">지식베이스 · 문제 은행</h2>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            마스터 개념 등록, 학생어 별칭 추가, 그리고 과거 세션의 문제 데이터를 검색하고 관리합니다.
          </p>
          <div className="mt-5 flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider">
            <span className="text-zinc-400">개념 {totalConceptNodes || 0}개</span>
            <span className={(nullEmbeddingCount || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}>
              임베딩 대기 {nullEmbeddingCount || 0}개
            </span>
          </div>
        </Link>

        <Link
          href="/admin/sessions"
          className="block bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 hover:border-blue-200 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 bg-zinc-50 text-zinc-600 rounded-xl flex items-center justify-center mb-4">
            <Loader2 size={20} />
          </div>
          <h2 className="text-lg font-bold text-zinc-900">세션 · 대화 로그</h2>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            전체 튜터링 세션의 상태와 상세 대화 흐름, 생성된 리포트를 타임라인 순으로 확인합니다.
          </p>
          <div className="mt-5 flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            <span>세션 {totalSessions || 0}건</span>
            <span>리포트 {totalReports || 0}건</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
