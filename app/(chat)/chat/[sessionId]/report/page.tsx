// ============================================================
// AHA v5 — /chat/[sessionId]/report: 세션 리포트 페이지
// ============================================================
// completed 상태의 세션에서만 접근 가능합니다.
// 모든 데이터 로딩과 snapshot 생성은 report-service에서 수행합니다.
// ============================================================

import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildLoginPath } from '@/lib/auth';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import {
  CheckCircle2,
  ArrowLeft,
  BookOpen,
  AlertCircle,
  MessageSquare,
  BarChart2,
  Lightbulb,
} from 'lucide-react';
import { getOrBuildSessionReport } from '@/lib/services/report-service';
import { ReportRegenerateButton } from './_components/report-regenerate-button';
import { PathVisualizer } from './_components/path-visualizer';

type AhaMomentItem = {
  turn: number | null;
  nodeId: string;
  utterance: string;
};

function cleanProblemStatementForReport(text: string): string {
  return text
    .replace(/\[\s*시각\s*정보\s*복원\s*\][\s\S]*?(?=\n\s*\[[^\]]+\]|\n\s*(?:문제|원문)\s*[:：]|$)/gi, '')
    .replace(/\[\s*그래프\s*정보\s*\][\s\S]*?(?=\n\s*\[[^\]]+\]|\n\s*(?:문제|원문)\s*[:：]|$)/gi, '')
    .replace(/^\s*(?:문제|원문)\s*[:：]\s*/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function maskInternalConceptCodes(text: string, conceptDisplayMap: Record<string, string>): string {
  let cleaned = text;

  for (const [code, label] of Object.entries(conceptDisplayMap)) {
    if (!code || !label) continue;
    cleaned = cleaned.replaceAll(code, label);
  }

  return cleaned
    .replace(/\[?([A-Z0-9]+_(?:PD|PP|PC)_[A-Z0-9_]+)\]?/gi, '해당 개념')
    .replace(/\[해당 개념\]/g, '해당 개념')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getMetricNumber(value: unknown, key: string): number | null {
  if (!isRecord(value)) return null;
  const metric = value[key];
  return typeof metric === 'number' && Number.isFinite(metric) ? metric : null;
}

function AhaMomentUtterance({ text }: { text: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-amber leading-relaxed **:my-0 [&_p]:inline">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function normalizeAhaMomentItems(value: unknown): AhaMomentItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const utterance = typeof item.utterance === 'string' ? item.utterance.trim() : '';
    if (!utterance) return [];

    return [{
      turn: typeof item.turn === 'number' && Number.isFinite(item.turn) ? item.turn : null,
      nodeId: typeof item.node_id === 'string' ? item.node_id : '',
      utterance,
    }];
  });
}

export default async function SessionReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(buildLoginPath(`/chat/${sessionId}/report`));

  let report;
  try {
    report = await getOrBuildSessionReport(sessionId, user.id);
  } catch (err: unknown) {
    const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;
    if (code === 'NOT_FOUND') notFound();
    if (code === 'NOT_COMPLETED') redirect(`/chat/${sessionId}`);
    throw err; // 예상치 못한 오류는 Next.js error boundary로
  }

  const { session, analysis, dialogueLogs, bottlenecks } = report;
  const conceptLabel = (code: string | null | undefined) => {
    if (!code) return '개념 매핑 없음';
    return report.conceptDisplayMap[code] ?? '개념 정보 확인 중';
  };
  const resolvedBottlenecks = bottlenecks.filter((b) => b.isResolved);
  const unresolvedBottlenecks = bottlenecks.filter((b) => !b.isResolved);
  const summaryGenerationFailed = report.reportState.summaryStatus === 'fallback';
  const hasNewDialogueSinceReport = report.reportState.hasNewDialogueSinceReport;
  const persistedReport = report.persistedReport;
  const hasGraphData = analysis.graphData.phases.length > 0;
  const missingCoreAnalysis = analysis.requiredConcepts.length === 0 || !hasGraphData;
  const ahaMoments = normalizeAhaMomentItems(persistedReport?.ahaMoments);
  const totalTurnsMetric = getMetricNumber(persistedReport?.performanceMetrics, 'total_turns');
  const aiInterventionsMetric = getMetricNumber(persistedReport?.performanceMetrics, 'ai_interventions');
  const resolvedBottlenecksMetric = getMetricNumber(persistedReport?.performanceMetrics, 'resolved_bottlenecks');

  const sessionDate = new Date(session.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const turnCount = Math.floor(dialogueLogs.length / 2);
  const visibleDialogueLogs = dialogueLogs.slice(0, 3);
  const hiddenDialogueLogs = dialogueLogs.slice(3);
  const displayedProblemText = cleanProblemStatementForReport(session.extractedText) || session.extractedText;
  const displayedTutorSummary = persistedReport
    ? maskInternalConceptCodes(persistedReport.aiTutorSummary.trim(), report.conceptDisplayMap)
    : '';
  const renderDialogueLog = (log: (typeof dialogueLogs)[number]) => (
    <div
      key={log.id}
      className={`text-xs p-3 rounded-xl ${log.speaker === 'student'
        ? 'bg-zinc-50 text-zinc-700 border border-zinc-100'
        : 'bg-blue-50 text-blue-800 border border-blue-100'
        }`}
    >
      <p className="font-semibold mb-1 text-[10px] uppercase tracking-wide opacity-60">
        {log.speaker === 'student' ? '학생' : 'AHA 튜터'}
      </p>
      <div className="prose prose-sm prose-zinc max-w-none text-xs leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {log.text}
        </ReactMarkdown>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden overscroll-x-none bg-zinc-50">
      {/* 헤더 */}
      <div className="safe-top sticky top-0 z-10 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-6">
          <Link
            href={`/chat/${sessionId}`}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft size={16} />
            대화로 돌아가기
          </Link>
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
            <BarChart2 size={16} />
            세션 리포트
          </div>
        </div>
      </div>

      <div className="safe-bottom mx-auto max-w-3xl space-y-6 px-5 py-6 pb-12 sm:px-6 sm:py-8">
        {/* 상태 헤더 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-full">
              <CheckCircle2 size={12} />
              세션 완료
            </span>
            <span className="text-xs text-zinc-400">{sessionDate}</span>
          </div>
          <div className="prose prose-sm prose-zinc max-w-none text-sm leading-relaxed **:my-0">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {displayedProblemText}
            </ReactMarkdown>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-zinc-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-zinc-900">{turnCount}</p>
              <p className="text-xs text-zinc-400 mt-1">대화 턴</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-zinc-900">{bottlenecks.length}</p>
              <p className="text-xs text-zinc-400 mt-1">막힌 지점</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{resolvedBottlenecks.length}</p>
              <p className="text-xs text-zinc-400 mt-1">스스로 해결</p>
            </div>
          </div>
        </div>

        {summaryGenerationFailed && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-900">리포트 생성에 실패했습니다.</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  요약 생성 중 오류가 발생해 기본 리포트만 표시하고 있습니다. 다시 생성하면 최신 상태로 한 번 더 시도합니다.
                </p>
              </div>
              <ReportRegenerateButton sessionId={sessionId} />
            </div>
          </div>
        )}

        {!summaryGenerationFailed && hasNewDialogueSinceReport && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-900">리포트 생성 이후 새 대화가 있습니다.</p>
                <p className="mt-1 text-xs leading-5 text-blue-800">
                  완료 후 이어진 채팅을 반영하려면 리포트를 다시 생성하세요.
                </p>
              </div>
              <ReportRegenerateButton sessionId={sessionId} />
            </div>
          </div>
        )}

        {!summaryGenerationFailed && !hasNewDialogueSinceReport && missingCoreAnalysis && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-900">리포트 분석 데이터가 부족합니다.</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  필요 개념 또는 전략 그래프가 아직 완성되지 않았습니다. 재생성하면 개념 추출과 경로 분석을 다시 시도합니다.
                </p>
              </div>
              <ReportRegenerateButton sessionId={sessionId} />
            </div>
          </div>
        )}

        {/* 필요 개념 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={16} className="text-zinc-700" />
            <h2 className="font-semibold text-zinc-900 text-sm">이 문제에 필요한 개념</h2>
          </div>
          {analysis.requiredConcepts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {analysis.requiredConcepts.map((concept, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-100"
                >
                  {conceptLabel(concept)}
                </span>
              ))}
            </div>
          ) : analysis.wasAnalyzedOnDemand ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-medium text-amber-900">개념 분석 후에도 저장된 개념이 없습니다.</p>
              <p className="text-xs text-amber-700 mt-1">이 세션에서는 동기 분석을 수행했지만 snapshot에 저장할 required concepts가 생성되지 않았습니다.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-sm font-medium text-zinc-800">분석할 개념이 없습니다.</p>
              <p className="text-xs text-zinc-500 mt-1">이 세션에서는 추출된 필요 개념이 아직 없습니다.</p>
            </div>
          )}
        </div>

        {/* 병목 지점 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={16} className="text-zinc-700" />
            <h2 className="font-semibold text-zinc-900 text-sm">막혔던 지점 분석</h2>
          </div>
          <div className="space-y-3">
            {bottlenecks.length === 0 && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-800">감지된 병목 지점이 없습니다.</p>
                <p className="text-xs text-zinc-500 mt-1">이번 세션에서는 특정 개념 오해나 막힘이 저장되지 않았습니다.</p>
              </div>
            )}
            {unresolvedBottlenecks.length > 0 && (
              <>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">미해결</p>
                {unresolvedBottlenecks.map((b) => (
                  <div key={b.id} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-red-700">{conceptLabel(b.conceptId)}</p>
                      <div className="prose prose-sm prose-red max-w-none text-xs leading-relaxed text-red-600 mt-0.5">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {b.description}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {resolvedBottlenecks.length > 0 && (
              <>
                <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mt-4">스스로 해결 ✓</p>
                {resolvedBottlenecks.map((b) => (
                  <div key={b.id} className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-emerald-700">{conceptLabel(b.conceptId)}</p>
                      <div className="prose prose-sm prose-emerald max-w-none text-xs leading-relaxed text-emerald-600 mt-0.5">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {b.description}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* 전략 그래프 경로 시각화 */}
        {hasGraphData ? (
          <PathVisualizer
            graphData={analysis.graphData}
            bottlenecks={bottlenecks}
            conceptDisplayMap={report.conceptDisplayMap}
          />
        ) : (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-zinc-900">풀이 경로 분석 준비 중</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              이 리포트에는 아직 전략 그래프가 생성되지 않아 경로 비교를 표시할 수 없습니다. 리포트 재생성을 누르면 개념 추출과 경로 분석을 다시 시도합니다.
            </p>
            {missingCoreAnalysis && !summaryGenerationFailed && !hasNewDialogueSinceReport ? (
              <div className="mt-4">
                <ReportRegenerateButton sessionId={sessionId} />
              </div>
            ) : null}
          </div>
        )}

        {/* 저장된 세션 리포트 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-zinc-700" />
            <h2 className="font-semibold text-zinc-900 text-sm">저장된 세션 리포트</h2>
          </div>

          {!persistedReport ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-sm font-medium text-zinc-800">저장된 세션 리포트가 없습니다.</p>
              <p className="text-xs text-zinc-500 mt-1">세션 리포트 생성이 완료되지 않아 표시할 요약 데이터가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-2">
                  AI Tutor Summary
                </p>
                <div className="prose prose-sm prose-zinc max-w-none text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {displayedTutorSummary || '저장된 튜터 요약이 없습니다.'}
                  </ReactMarkdown>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-2">
                  Performance Metrics
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-center">
                    <p className="text-lg font-bold text-zinc-900">{totalTurnsMetric ?? '없음'}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">학생 발화 수</p>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-center">
                    <p className="text-lg font-bold text-zinc-900">{aiInterventionsMetric ?? '없음'}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">튜터 개입 수</p>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-center">
                    <p className="text-lg font-bold text-emerald-600">{resolvedBottlenecksMetric ?? '없음'}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">해결된 막힘</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-2">
                  잘한 개념
                </p>
                {persistedReport.masteredConcepts.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {persistedReport.masteredConcepts.map((concept) => (
                      <span
                        key={concept}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-100"
                      >
                        {conceptLabel(concept)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <p className="text-sm font-medium text-zinc-800">확정된 잘한 개념이 없습니다.</p>
                    <p className="text-xs text-zinc-500 mt-1">학생이 스스로 적용한 것으로 검증된 개념만 표시합니다.</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-2">
                  Aha Moments
                </p>
                {ahaMoments.length > 0 ? (
                  <div className="space-y-2">
                    {ahaMoments.map((moment, index) => (
                      <div key={`${moment.turn ?? 'unknown'}-${index}`} className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-amber-700">
                          <span>{moment.turn ? `Turn ${moment.turn}` : 'Turn 정보 없음'}</span>
                          <span className="text-amber-300">·</span>
                          <span>{moment.nodeId ? conceptLabel(moment.nodeId) : '연결된 개념 없음'}</span>
                        </div>
                        <div className="text-sm leading-relaxed text-zinc-800 mt-2">
                          <AhaMomentUtterance text={moment.utterance} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <p className="text-sm font-medium text-zinc-800">기록된 Aha moment가 없습니다.</p>
                    <p className="text-xs text-zinc-500 mt-1">학생이 명확히 깨달음을 표현한 발화만 표시합니다.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 전체 대화 기록 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={16} className="text-zinc-700" />
            <h2 className="font-semibold text-zinc-900 text-sm">전체 대화 기록</h2>
          </div>
          <div className="space-y-3">
            {visibleDialogueLogs.map(renderDialogueLog)}
            {hiddenDialogueLogs.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer list-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100">
                  나머지 대화 {hiddenDialogueLogs.length}개 더보기
                </summary>
                <div className="mt-3 space-y-3">
                  {hiddenDialogueLogs.map(renderDialogueLog)}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
