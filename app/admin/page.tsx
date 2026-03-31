import { getSupabaseAdmin } from '@/lib/supabase/client';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = getSupabaseAdmin();

  // 통계 집계 (간단 버전)
  const { count: totalSessions } = await supabase
    .from('validations')
    .select('*', { count: 'exact', head: true });

  const { count: parsedSessions } = await supabase
    .from('operations')
    .select('*', { count: 'exact', head: true });

  // 최근 원문 대화 20개 가져오기
  const { data: validations } = await supabase
    .from('validations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">대시보드</h1>
        <p className="text-zinc-500 mt-2 text-sm">전체 유저, 세션 통계 및 시스템 현황을 한눈에 파악합니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <h3 className="text-zinc-500 text-sm font-medium">총 세션 수</h3>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{totalSessions || 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <h3 className="text-zinc-500 text-sm font-medium">파싱 성공 세션</h3>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{parsedSessions || 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-zinc-100 shadow-sm">
          <h3 className="text-zinc-500 text-sm font-medium">오늘 생성된 문제 전략</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
        </div>
      </div>

      {/* 대화 로그 모니터링 */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-white">
          <h2 className="text-lg font-bold text-zinc-900">최근 대화 원문 모니터링 (Validations)</h2>
          <p className="text-sm text-zinc-500">LLM 파싱 실패 여부와 무관하게 모든 대화가 저장됩니다.</p>
        </div>

        <div className="divide-y divide-zinc-100">
          {validations?.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">아직 저장된 대화가 없습니다.</div>
          ) : (
            (validations as any[])?.map((v) => (
              <details key={v.id} className="group">
                <summary className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-50 transition-colors list-none">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-zinc-400 bg-zinc-100 px-2 py-1 rounded">
                      {v.session_id.split('-')[1] || 'Session'}
                    </span>
                    <span className="text-sm text-zinc-600 font-medium">
                      {v.raw_transcript.slice(0, 40).replace(/\n/g, ' ')}...
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {format(new Date(v.created_at), 'yyyy/MM/dd HH:mm')}
                  </span>
                </summary>
                <div className="p-4 bg-zinc-50 text-sm border-t border-zinc-100">
                  <pre className="whitespace-pre-wrap font-sans text-zinc-700 leading-relaxed">
                    {v.raw_transcript}
                  </pre>
                </div>
              </details>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
