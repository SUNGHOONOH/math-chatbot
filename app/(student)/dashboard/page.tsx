// ============================================================
// AHA v5 — 학생 메타인지 대시보드
// ============================================================
// AGENTS.md §3-2 준수:
// - 마스터 개념: session_reports.mastered_concepts 배열 집계 → Top 순위
// - 취약 개념: learning_bottlenecks (is_resolved = false) 집계 → Top 순위
// - Outer Loop 연동: [이 개념만 집중 훈련하기] 버튼 배치
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { buildLoginPath } from '@/lib/auth';
import { DASHBOARD_TOP_N_CONCEPTS } from '@/lib/constants';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ChartColumnIncreasing, CircleCheckBig, TriangleAlert } from 'lucide-react';

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

function fallbackConceptLabel(code: string): string {
  if (code === 'unmapped_bottleneck') return '아직 매핑되지 않은 병목';
  if (code.startsWith('IR-')) return `조건 해석: ${code.slice(3)}`;
  if (code.startsWith('SM-')) return `전략: ${code.slice(3)}`;
  if (code.startsWith('PC-')) return `계산 처리: ${code.slice(3)}`;
  if (code.endsWith('_PC')) return `${code.replace(/_PC$/, '')} 계산`;
  return code;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginPath('/dashboard'));
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

  const conceptCodes = Array.from(
    new Set([
      ...masteredRanking.map((item) => item.concept),
      ...weakRanking.map((item) => item.concept),
    ])
  );

  const { data: conceptRows } = conceptCodes.length > 0
    ? await supabase
        .from('concept_nodes_reference')
        .select('concept_code, title')
        .in('concept_code', conceptCodes)
    : { data: [] };

  const conceptTitleMap = new Map<string, string>();
  for (const row of conceptRows ?? []) {
    if (row.concept_code && row.title) {
      conceptTitleMap.set(row.concept_code, row.title);
    }
  }

  const getConceptLabel = (code: string) => conceptTitleMap.get(code) ?? fallbackConceptLabel(code);

  // 3. 총 세션 수
  const { count: totalSessions } = await supabase
    .from('tutoring_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', user.id);

  return (
    <div className="space-y-8">
      <header className="rounded-[28px] border border-zinc-200 bg-white px-6 py-6 shadow-sm md:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <ChartColumnIncreasing size={14} />
              Learning Dashboard
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">나의 학습 대시보드</h1>
              <p className="max-w-2xl text-sm leading-6 text-zinc-500">
                총 {totalSessions || 0}개의 문제를 풀었습니다. 최근 세션을 바탕으로 강점 개념과 반복해서 막히는 개념을 정리했습니다.
              </p>
            </div>
          </div>

          <Link
            href="/chat/new"
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            새 질문 시작하기
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 마스터 개념 순위 */}
        <section className="space-y-4 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-700">
            <CircleCheckBig size={18} />
            마스터한 개념 Top {masteredRanking.length}
          </h2>
          {masteredRanking.length === 0 ? (
            <p className="text-sm text-zinc-400">아직 데이터가 없습니다. 문제를 풀어보세요.</p>
          ) : (
            <ul className="space-y-3">
              {masteredRanking.map((item, i) => (
                <li key={item.concept} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-emerald-600">{i + 1}</span>
                    <div className="flex flex-col">
                      <span className="text-sm text-zinc-800">{getConceptLabel(item.concept)}</span>
                      <span className="font-mono text-[11px] text-zinc-400">{item.concept}</span>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500">{item.count}회 마스터</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 취약 개념 순위 */}
        <section className="space-y-4 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-rose-700">
            <TriangleAlert size={18} />
            취약 개념 Top {weakRanking.length}
          </h2>
          {weakRanking.length === 0 ? (
            <p className="text-sm text-zinc-400">취약 개념이 없습니다. 훌륭합니다.</p>
          ) : (
            <ul className="space-y-3">
              {weakRanking.map((item, i) => (
                <li key={item.concept} className="space-y-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-rose-600">{i + 1}</span>
                    <div className="flex flex-col">
                      <span className="text-sm text-zinc-800">{getConceptLabel(item.concept)}</span>
                      <span className="font-mono text-[11px] text-zinc-400">{item.concept}</span>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500">{item.count}회 미해결</span>
                </div>
                  <Link
                    href={`/practice?concept=${encodeURIComponent(item.concept)}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                  >
                    이 개념만 집중 훈련하기
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="text-center text-sm text-zinc-400">
        데이터는 문제를 풀 때마다 자동으로 업데이트됩니다.
      </footer>
    </div>
  );
}
