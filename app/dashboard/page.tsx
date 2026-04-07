// ============================================================
// AHA v5 — 학생 메타인지 대시보드
// ============================================================
// AGENTS.md §3-2 준수:
// - 마스터 개념: session_reports.mastered_concepts 배열 집계 → Top 순위
// - 취약 개념: learning_bottlenecks (is_resolved = false) 집계 → Top 순위
// - Outer Loop 연동: [이 개념만 집중 훈련하기] 버튼 배치
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { DASHBOARD_TOP_N_CONCEPTS } from '@/lib/constants';
import { redirect } from 'next/navigation';
import Link from 'next/link';

// ── 집계 유틸리티 ──
function countOccurrences(arr: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of arr) {
    map.set(item, (map.get(item) || 0) + 1);
  }
  return map;
}

function topN(map: Map<string, number>, n: number): Array<{ concept: string; count: number }> {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([concept, count]) => ({ concept, count }));
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // ── 데이터 페칭 (Supabase JOIN 활용하여 한 번에) ──

  // 1. 마스터 개념: session_reports → mastered_concepts 집계
  const { data: reports } = await supabase
    .from('session_reports')
    .select('mastered_concepts, tutoring_sessions!inner(student_id)')
    .eq('tutoring_sessions.student_id', user.id);

  const allMastered: string[] = [];
  if (reports) {
    for (const report of reports) {
      if (Array.isArray(report.mastered_concepts)) {
        allMastered.push(...report.mastered_concepts);
      }
    }
  }
  const masteredRanking = topN(countOccurrences(allMastered), DASHBOARD_TOP_N_CONCEPTS);

  // 2. 취약 개념: learning_bottlenecks (is_resolved = false) 집계
  const { data: bottlenecks } = await supabase
    .from('learning_bottlenecks')
    .select('mapped_concept_id, tutoring_sessions!inner(student_id)')
    .eq('tutoring_sessions.student_id', user.id)
    .eq('is_resolved_by_student', false);

  const weakConcepts: string[] = [];
  if (bottlenecks) {
    for (const b of bottlenecks) {
      if (b.mapped_concept_id && b.mapped_concept_id !== 'NEW_NODE') {
        weakConcepts.push(b.mapped_concept_id);
      }
    }
  }
  const weakRanking = topN(countOccurrences(weakConcepts), DASHBOARD_TOP_N_CONCEPTS);

  // 3. 총 세션 수
  const { count: totalSessions } = await supabase
    .from('tutoring_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', user.id);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* 헤더 */}
        <header className="flex justify-between items-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              📊 나의 학습 대시보드
            </h1>
            <p className="text-gray-400">
              총 {totalSessions || 0}개의 문제를 풀었습니다. 아래에서 나의 강점과 약점을 확인하세요.
            </p>
          </div>

          <Link
            href="/"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-xl transition-all border border-gray-700 flex items-center gap-2"
          >
            🏠 홈으로
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 마스터 개념 순위 */}
          <section className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
              ✅ 마스터한 개념 Top {masteredRanking.length}
            </h2>
            {masteredRanking.length === 0 ? (
              <p className="text-gray-500 text-sm">아직 데이터가 없습니다. 문제를 풀어보세요!</p>
            ) : (
              <ul className="space-y-3">
                {masteredRanking.map((item, i) => (
                  <li key={item.concept} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-bold text-lg">{i + 1}</span>
                      <span className="text-sm font-mono text-gray-200">{item.concept}</span>
                    </div>
                    <span className="text-xs text-gray-400">{item.count}회 마스터</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 취약 개념 순위 */}
          <section className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-rose-400 flex items-center gap-2">
              ⚠️ 취약 개념 Top {weakRanking.length}
            </h2>
            {weakRanking.length === 0 ? (
              <p className="text-gray-500 text-sm">취약 개념이 없습니다. 훌륭합니다! 🎉</p>
            ) : (
              <ul className="space-y-3">
                {weakRanking.map((item, i) => (
                  <li key={item.concept} className="bg-gray-800/50 rounded-lg px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-rose-400 font-bold text-lg">{i + 1}</span>
                        <span className="text-sm font-mono text-gray-200">{item.concept}</span>
                      </div>
                      <span className="text-xs text-gray-400">{item.count}회 미해결</span>
                    </div>
                    <Link
                      href={`/practice?concept=${encodeURIComponent(item.concept)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white text-xs font-medium rounded-lg transition-all duration-200 shadow-lg shadow-rose-900/30"
                    >
                      🎯 이 개념만 집중 훈련하기
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* 하단 안내 */}
        <footer className="text-center text-gray-500 text-sm pt-4">
          데이터는 문제를 풀 때마다 자동으로 업데이트됩니다.
        </footer>
      </div>
    </main>
  );
}
