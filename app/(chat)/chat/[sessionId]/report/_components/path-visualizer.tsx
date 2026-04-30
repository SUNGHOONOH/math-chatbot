'use client';

import { CheckCircle2, AlertCircle, Target, Lightbulb, Map } from 'lucide-react';
import { motion } from 'framer-motion';

// Simplified types to avoid importing from ai-service directly to prevent circular/server-client issues if any
interface StrategyGraphWay {
  way_id: 'A' | 'B' | 'C';
  is_primary: boolean;
  summary: string;
  concepts: string[];
}
interface StrategyGraphPhase {
  phase: number;
  goal_code: string;
  goal_type: 'MG' | 'G';
  goal: string;
  summary: string;
  requires: string[];
  ways: StrategyGraphWay[];
}
interface StrategyGraphData {
  version: 1;
  phases: StrategyGraphPhase[];
}

interface PathVisualizerProps {
  graphData?: StrategyGraphData | null;
  bottlenecks?: Array<{
    id: string;
    conceptId: string | null;
    description: string;
    isResolved: boolean;
  }>;
  conceptDisplayMap: Record<string, string>;
}

export function PathVisualizer({
  graphData,
  bottlenecks = [],
  conceptDisplayMap,
}: PathVisualizerProps) {
  if (!graphData || graphData.phases.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-dashed border-zinc-300 p-6 shadow-sm mt-8">
        <div className="flex items-center gap-2">
          <Lightbulb className="text-amber-500" size={18} />
          <h2 className="text-sm font-semibold text-zinc-900">풀이 경로 분석 준비 중</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          이 리포트에는 아직 전략 그래프가 생성되지 않아 경로 비교를 표시할 수 없습니다. 리포트 재생성을 누르면 개념 추출과 경로 분석을 다시 시도합니다.
        </p>
      </div>
    );
  }

  // Helper to resolve concept label
  const getConceptLabel = (code: string) => conceptDisplayMap[code] ?? '개념 정보 확인 중';
  const getBottlenecksForConcepts = (concepts: string[]) =>
    bottlenecks.filter((bottleneck) => bottleneck.conceptId && concepts.includes(bottleneck.conceptId));
  const graphConcepts = new Set(graphData.phases.flatMap((phase) => phase.ways.flatMap((way) => way.concepts)));
  const placedBottlenecks = bottlenecks.filter((bottleneck) => bottleneck.conceptId && graphConcepts.has(bottleneck.conceptId));
  const unplacedBottlenecks = bottlenecks.filter((bottleneck) => !bottleneck.conceptId || !graphConcepts.has(bottleneck.conceptId));
  const shortDescription = (description: string) => {
    const normalized = description.trim();
    return normalized.length > 72 ? `${normalized.slice(0, 72)}...` : normalized;
  };
  const unresolvedCount = bottlenecks.filter((bottleneck) => !bottleneck.isResolved).length;
  const resolvedCount = bottlenecks.filter((bottleneck) => bottleneck.isResolved).length;
  const placedCount = placedBottlenecks.length;

  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 bg-zinc-900 px-5 py-5 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
            <Map className="text-zinc-100" size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-zinc-50 font-bold text-base">풀이 경로 분석 (Strategy Path)</h2>
            <p className="text-zinc-400 text-xs mt-0.5">AI 추천 경로와 나의 실제 풀이 경로 비교</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <span className="text-zinc-300 font-medium">AI 추천 경로</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-zinc-500 ring-2 ring-zinc-500/20" />
            <span className="text-zinc-300 font-medium">다른 가능 경로</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="text-red-400" size={14} />
            <span className="text-zinc-300 font-medium">막혔던 개념</span>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {/* Feedback Alert */}
        <div className="mb-8 p-4 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-start gap-3">
          <Lightbulb className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm font-semibold text-zinc-900">학생 풀이에 대한 코멘트</p>
            <p className="text-sm text-zinc-600 mt-1 leading-relaxed">
              {bottlenecks.length > 0 && placedCount > 0
                ? `감지된 병목 ${bottlenecks.length}개 중 ${placedCount}개를 풀이 로드맵의 관련 개념 위치에 표시했습니다. 미해결 ${unresolvedCount}개, 해결 ${resolvedCount}개입니다.`
                : bottlenecks.length > 0
                  ? `감지된 병목 ${bottlenecks.length}개가 있지만 현재 풀이 로드맵의 개념과 직접 연결되지 않았습니다. 미해결 ${unresolvedCount}개, 해결 ${resolvedCount}개입니다.`
                : '감지된 병목이 없어 AI 추천 경로와 다른 가능 경로만 표시합니다.'}
            </p>
          </div>
        </div>

        {/* The Graph */}
        <div className="relative pl-4 sm:pl-6 lg:pl-10">
          {/* Main vertical line for timeline */}
          <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-zinc-100 sm:left-6 lg:left-10" />

          <div className="space-y-12">
            {graphData.phases.map((phase, index) => {
              const isGoal = phase.goal_type === 'G';
              
              return (
                <motion.div
                  key={phase.phase}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  className="relative"
                >
                  {/* Timeline Dot */}
                  <div className="absolute left-[-25px] top-6 z-10 flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-zinc-200 bg-white sm:left-[-29px]">
                    <div className="w-1.5 h-1.5 bg-zinc-200 rounded-full" />
                  </div>

                  {/* Phase Label */}
                  <div className="mb-4 pt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Step {phase.phase}</span>
                      <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                        {phase.goal}
                        {isGoal && <Target size={16} className="text-emerald-500" />}
                      </h3>
                    </div>
                    {phase.summary && <p className="text-xs text-zinc-500 mt-1">{phase.summary}</p>}
                  </div>

                  {/* Ways Cards (Alternatives) */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {phase.ways.map((way) => {
                      const isPrimary = way.is_primary;
                      const wayBottlenecks = getBottlenecksForConcepts(way.concepts);
                      const unresolvedWayBottlenecks = wayBottlenecks.filter((bottleneck) => !bottleneck.isResolved);
                      const resolvedWayBottlenecks = wayBottlenecks.filter((bottleneck) => bottleneck.isResolved);

                      // Tailwind dynamic classes
                      let borderClass = 'border-zinc-200 bg-white shadow-sm hover:border-zinc-300';
                      let headerClass = 'text-zinc-800';
                      let badgeClass = 'bg-zinc-100 text-zinc-600';
                      
                      if (isPrimary) {
                        borderClass = 'border-emerald-300 border-2 bg-emerald-50 shadow-sm shadow-emerald-500/10';
                        headerClass = 'text-emerald-700 font-bold';
                        badgeClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                      } else {
                        borderClass = 'border-zinc-100 bg-zinc-50';
                      }

                      return (
                        <div key={way.way_id} className={`relative rounded-2xl p-4 transition-all ${borderClass}`}>
                          
                          {/* Way Header */}
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
                              Way {way.way_id}
                            </span>
                            <div className="flex gap-1.5">
                              {isPrimary && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                                  <CheckCircle2 size={12} />
                                  Recommended
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Way Content */}
                          <div className="mt-3">
                            <h4 className={`text-sm ${headerClass} leading-snug`}>
                              {way.summary}
                            </h4>
                          </div>

                          {/* Concepts Badges */}
                          {way.concepts.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                              {way.concepts.map((concept, i) => {
                                const conceptBottlenecks = bottlenecks.filter((bottleneck) => bottleneck.conceptId === concept);
                                const hasUnresolved = conceptBottlenecks.some((bottleneck) => !bottleneck.isResolved);
                                const hasResolved = conceptBottlenecks.some((bottleneck) => bottleneck.isResolved);
                                const markerClass = hasUnresolved
                                  ? 'text-red-700 border-red-200 bg-red-100/70'
                                  : hasResolved
                                    ? 'text-amber-700 border-amber-200 bg-amber-100/70'
                                    : isPrimary
                                      ? 'text-emerald-700 border-emerald-200 bg-emerald-100/50'
                                      : 'text-zinc-500 border-zinc-200';

                                return (
                                  <span key={i} className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border shrink-0 ${markerClass}`}>
                                    {(hasUnresolved || hasResolved) && (
                                      <AlertCircle size={11} className={hasUnresolved ? 'text-red-500' : 'text-amber-500'} />
                                    )}
                                    {getConceptLabel(concept)}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Bottleneck Marker */}
                          {unresolvedWayBottlenecks.length > 0 && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", bounce: 0.6 }}
                              className="absolute -right-3 -top-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 ring-4 ring-white"
                            >
                              <AlertCircle size={18} />
                            </motion.div>
                          )}
                          {unresolvedWayBottlenecks.length === 0 && resolvedWayBottlenecks.length > 0 && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", bounce: 0.6 }}
                              className="absolute -right-3 -top-3 w-8 h-8 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30 ring-4 ring-white"
                            >
                              <AlertCircle size={18} />
                            </motion.div>
                          )}

                          {wayBottlenecks.length > 0 && (
                            <div className="mt-4 space-y-2">
                              {wayBottlenecks.map((bottleneck) => (
                                <div
                                  key={bottleneck.id}
                                  className={`rounded-xl border px-3 py-2 text-[11px] leading-relaxed ${
                                    bottleneck.isResolved
                                      ? 'border-amber-100 bg-amber-50 text-amber-700'
                                      : 'border-red-100 bg-red-50 text-red-700'
                                  }`}
                                >
                                  {shortDescription(bottleneck.description)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {unplacedBottlenecks.length > 0 && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 shrink-0 text-amber-600" size={18} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">로드맵에 직접 연결되지 않은 병목</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  병목은 감지됐지만, 현재 저장된 풀이 로드맵의 개념 목록과 코드가 일치하지 않아 별도로 표시합니다.
                </p>
                <div className="mt-3 space-y-2">
                  {unplacedBottlenecks.map((bottleneck) => (
                    <div
                      key={bottleneck.id}
                      className="rounded-xl border border-amber-100 bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-amber-900"
                    >
                      <p className="font-semibold">
                        {bottleneck.conceptId ? getConceptLabel(bottleneck.conceptId) : '개념 매핑 없음'}
                      </p>
                      <p className="mt-1">{shortDescription(bottleneck.description)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
