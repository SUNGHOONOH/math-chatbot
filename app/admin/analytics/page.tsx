import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { BarChart3, TrendingUp, Users, Target, Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // 1분 캐싱

export default async function AnalyticsPage() {
  const supabase = getSupabaseAdmin();

  // 1. 핵심 KPI (총 세션, 병목, 해결)
  const [{ count: totalSessions }, { count: totalBottlenecks }, { count: resolvedBottlenecks }] = await Promise.all([
    supabase.from('tutoring_sessions').select('*', { count: 'exact', head: true }),
    supabase.from('learning_bottlenecks').select('*', { count: 'exact', head: true }),
    supabase.from('learning_bottlenecks').select('*', { count: 'exact', head: true }).eq('is_resolved_by_student', true)
  ]);

  // 2. 가장 많이 발생한 병목 현상 Top 5 (빈도순)
  const { data: bottlenecksData } = await supabase
    .from('learning_bottlenecks')
    .select('mapped_concept_id');

  const conceptFreq: Record<string, number> = {};
  if (bottlenecksData) {
    bottlenecksData.forEach(b => {
      const id = b.mapped_concept_id || 'unmapped';
      conceptFreq[id] = (conceptFreq[id] || 0) + 1;
    });
  }

  const topConcepts = Object.entries(conceptFreq)
    .filter(([id]) => id !== 'unmapped_bottleneck') // unmapped 제외
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const unmappedCount = conceptFreq['unmapped_bottleneck'] || 0;

  // 3. 상태 분포 (성공률, 포기율 추정)
  const { data: sessionStatusData } = await supabase
    .from('tutoring_sessions')
    .select('session_status, id');
    
  let completedCount = 0;
  let abandonedCount = 0;
  if (sessionStatusData) {
    sessionStatusData.forEach(s => {
      if (s.session_status === 'completed') completedCount++;
      if (s.session_status === 'abandoned') abandonedCount++;
    });
  }

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight flex items-center gap-3">
          <BarChart3 className="text-blue-600" />
          세션 통계 및 분석 (Insights)
        </h1>
        <p className="text-zinc-500 mt-2 text-sm">
          AHA 서비스 내에서 진행된 튜터링 세션의 통계와 학생들의 주요 학습 병목 지점을 시각화합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full opacity-50" />
          <h3 className="text-zinc-500 text-sm font-medium flex items-center gap-2 relative">
            <Users size={16} /> 총 세션 수
          </h3>
          <p className="text-4xl font-black text-zinc-900 mt-3 relative">{totalSessions || 0}</p>
        </div>
        
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-50 rounded-full opacity-50" />
          <h3 className="text-zinc-500 text-sm font-medium flex items-center gap-2 relative">
            <Activity size={16} /> 감지된 총 병목
          </h3>
          <p className="text-4xl font-black text-rose-600 mt-3 relative">{totalBottlenecks || 0}</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full opacity-50" />
          <h3 className="text-zinc-500 text-sm font-medium flex items-center gap-2 relative">
            <Target size={16} /> 학생 스스로 해결 (비율)
          </h3>
          <div className="mt-3 relative flex items-baseline gap-2">
            <p className="text-4xl font-black text-emerald-600">{resolvedBottlenecks || 0}</p>
            <p className="text-sm font-bold text-emerald-500">
              ({totalBottlenecks && resolvedBottlenecks ? Math.round((resolvedBottlenecks/totalBottlenecks)*100) : 0}%)
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 rounded-full opacity-50" />
          <h3 className="text-zinc-500 text-sm font-medium flex items-center gap-2 relative">
            <TrendingUp size={16} /> 세션 완료율
          </h3>
           <div className="mt-3 relative flex items-baseline gap-2">
            <p className="text-4xl font-black text-purple-600">{completedCount}</p>
            <p className="text-sm font-bold text-purple-500">
              ({totalSessions && completedCount ? Math.round((completedCount/totalSessions)*100) : 0}%)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
            <h2 className="text-lg font-bold text-zinc-900">가장 많이 발생하는 병목 지점 (Hot Concepts)</h2>
            <p className="text-xs text-zinc-500 mt-1">학생들이 지속적으로 막히는 핵심 개념 Top 5</p>
          </div>
          <div className="p-6 space-y-6">
            {topConcepts.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-6">병목 데이터가 충분하지 않습니다.</p>
            ) : (
              topConcepts.map(([concept, count], idx) => (
                <div key={concept} className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-xs bg-zinc-100 text-zinc-500 w-5 h-5 flex items-center justify-center rounded-full leading-none">
                        {idx + 1}
                      </span>
                      <span className="font-mono font-bold text-zinc-800">{concept}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900">{count}회</span>
                      <span className="text-zinc-400 text-xs w-8 text-right">({Math.round((count / (totalBottlenecks || 1)) * 100)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-2.5 rounded-full" 
                      style={{ width: `${Math.max(Math.round((count / (totalBottlenecks || 1)) * 100), 2)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col">
          <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
            <h2 className="text-lg font-bold text-zinc-900">미배정 진단 현황</h2>
            <p className="text-xs text-zinc-500 mt-1">AI가 적절한 지식을 찾지 못한 병목 (Candidate Bucket)</p>
          </div>
          <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-amber-50 border-4 border-amber-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl font-black text-amber-600">{unmappedCount}</span>
            </div>
            <h3 className="font-bold text-zinc-800">라벨링 필요 건 수</h3>
            <p className="text-xs text-zinc-500 mt-2 max-w-[200px] leading-relaxed">
              사전 정의된 개념 노드 및 규칙에 매핑되지 않아 별도의 진단 교정이 필요한 데이터입니다.
            </p>
            <a 
              href="/admin/labeling" 
              className="mt-6 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-bold rounded-xl transition-colors"
            >
              라벨링 도구 이동
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
