import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  const supabase = getSupabaseAdmin();

  const { count: totalSessions } = await supabase
    .from('tutoring_sessions')
    .select('*', { count: 'exact', head: true });

  const { count: totalBottlenecks } = await supabase
    .from('learning_bottlenecks')
    .select('*', { count: 'exact', head: true });

  const { data: recentLogs } = await supabase
    .from('dialogue_logs')
    .select('session_id, messages, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10);

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">대화 세션 조회</h1>
        <p className="text-zinc-500 mt-2 text-sm">
          tutoring_sessions, dialogue_logs, learning_bottlenecks, session_reports를 조인해 세션 단위로 조회합니다.
          <br />소크라틱 대화 품질과 병목 감지 결과를 함께 모니터링합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
          <h3 className="text-zinc-500 text-sm font-medium">총 세션 수</h3>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{totalSessions || 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
          <h3 className="text-zinc-500 text-sm font-medium">감지된 병목</h3>
          <p className="text-3xl font-bold text-rose-600 mt-2">{totalBottlenecks || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-600">전체 세션</span>
            <span className="px-3 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-400">최근 로그</span>
          </div>
          <div className="text-xs text-zinc-400 font-mono tracking-tighter">
            STORAGE v5 INTEGRATED
          </div>
        </div>

        <div className="divide-y divide-zinc-100">
          {(!recentLogs || recentLogs.length === 0) ? (
            <div className="p-10 text-center text-zinc-500">
              최근 대화 로그가 아직 없습니다.
            </div>
          ) : (
            recentLogs.map((log) => {
              const msgs = (log.messages as any[]) || [];
              const lastMsg = msgs[msgs.length - 1];
              if (!lastMsg) return null;
              const isStudent = lastMsg.role === 'student' || lastMsg.role === 'user';

              return (
                <div key={log.session_id} className="p-4 flex items-start gap-4 hover:bg-zinc-50 transition-colors">
                  <span className={`text-xs font-mono px-2 py-1 rounded shrink-0 ${isStudent ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                    {isStudent ? '학생' : 'AI'}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm text-zinc-700 line-clamp-2">{lastMsg.content}</p>
                    <p className="text-[11px] text-zinc-400 font-mono">
                      session: {log.session_id} · {new Date(log.updated_at).toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
