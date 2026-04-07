import { getSupabaseAdmin } from '@/lib/supabase/client';
import ConceptNodeImporter from '@/app/admin/_components/concept-node-importer';
import EmbeddingGenerator from '@/app/admin/_components/embedding-generator';
import StrategyVerifyList from '@/app/admin/_components/strategy-verify-list';

export const dynamic = 'force-dynamic';

export default async function LabelingPage() {
  const supabase = getSupabaseAdmin();

  const { count: totalConceptNodes } = await supabase
    .from('concept_nodes_reference')
    .select('*', { count: 'exact', head: true });

  const { count: nullEmbeddingCount } = await supabase
    .from('concept_nodes_reference')
    .select('*', { count: 'exact', head: true })
    .is('embedding', null);

  const { data: strategyGraphs } = await supabase
    .from('strategy_graphs')
    .select('problem_hash, is_human_verified, required_concepts, base_difficulty, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const verifiedCount = strategyGraphs?.filter((item) => item.is_human_verified).length ?? 0;
  const pendingCount = (strategyGraphs?.length ?? 0) - verifiedCount;

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">라벨링 · 문제 은행</h1>
          <p className="text-zinc-500 mt-2 text-sm max-w-2xl">
            개념 노드 사전과 전략 그래프 문제 은행을 한 화면에서 관리합니다.
            <br />노드 임포트, 임베딩 생성, 전략 그래프 검수를 이 경로에서 처리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-center">
            <span className="text-xs text-amber-600 font-bold block">검토 대기</span>
            <span className="text-xl font-bold text-amber-700">{pendingCount}</span>
          </div>
          <div className="bg-green-50 border border-green-200 px-4 py-2 rounded-xl text-center">
            <span className="text-xs text-green-600 font-bold block">검증 완료</span>
            <span className="text-xl font-bold text-green-700">{verifiedCount}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100">
          <h2 className="text-lg font-bold text-zinc-900">📦 개념 노드 임포터</h2>
          <p className="text-sm text-zinc-500 mt-1">
            JSON 배열을 붙여넣고 [DB 삽입] 버튼을 누르면 concept_nodes_reference 테이블에 upsert 됩니다.
          </p>
        </div>
        <div className="p-6 space-y-6">
          <ConceptNodeImporter />

          <div className="pt-4 border-t border-zinc-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-700">벡터 임베딩 상태</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  미생성: <span className={`font-bold ${(nullEmbeddingCount || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{nullEmbeddingCount || 0}개</span>
                  {' / '}전체: {totalConceptNodes || 0}개
                </p>
              </div>
            </div>
            <EmbeddingGenerator />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100">
          <h2 className="text-lg font-bold text-zinc-900">🧩 문제 은행 (Strategy Graphs)</h2>
          <p className="text-sm text-zinc-500 mt-1">
            등록된 문제 목록입니다. 토글을 눌러 검증 상태(is_human_verified)를 즉시 변경할 수 있습니다.
          </p>
        </div>
        <StrategyVerifyList initialData={strategyGraphs || []} />
      </div>
    </div>
  );
}
