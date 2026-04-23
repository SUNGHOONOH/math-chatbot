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
  studentEstimatedPath?: Array<{
    phase: number;
    goalCode: string;
    wayId: 'A' | 'B' | 'C';
  }>;
  pathFeedbackKo?: string;
  conceptDisplayMap: Record<string, string>;
}

export function PathVisualizer({
  graphData,
  studentEstimatedPath = [],
  pathFeedbackKo,
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

  // Final phase in student path to show bottleneck exclamation
  const lastStudentPhase = studentEstimatedPath.length > 0
    ? studentEstimatedPath[studentEstimatedPath.length - 1].phase
    : -1;
  const hasStudentPath = studentEstimatedPath.length > 0;
  
  const hasReachedGoal = studentEstimatedPath.some(
    (p) => graphData.phases.find(ph => ph.phase === p.phase)?.goal_type === 'G'
  );

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm mt-8">
      {/* Header */}
      <div className="bg-zinc-900 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
            <Map className="text-zinc-100" size={20} />
          </div>
          <div>
            <h2 className="text-zinc-50 font-bold text-base">풀이 경로 분석 (Strategy Path)</h2>
            <p className="text-zinc-400 text-xs mt-0.5">AI 추천 경로와 나의 실제 풀이 경로 비교</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <span className="text-zinc-300 font-medium">추천 경로</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-500/20" />
            <span className="text-zinc-300 font-medium">나의 경로</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Feedback Alert */}
        <div className="mb-8 p-4 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-start gap-3">
          <Lightbulb className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm font-semibold text-zinc-900">AI의 경로 코멘트</p>
            <p className="text-sm text-zinc-600 mt-1 leading-relaxed">
              {pathFeedbackKo
                ? pathFeedbackKo
                : hasStudentPath
                  ? '학생 경로는 일부 추정되었지만, 저장된 경로 피드백이 없습니다.'
                  : '학생 풀이 경로를 확정할 근거가 부족해 추천 경로만 표시합니다.'}
            </p>
          </div>
        </div>

        {/* The Graph */}
        <div className="relative pl-6 lg:pl-10">
          {/* Main vertical line for timeline */}
          <div className="absolute left-6 lg:left-10 top-6 bottom-6 w-0.5 bg-zinc-100" />

          <div className="space-y-12">
            {graphData.phases.map((phase, index) => {
              const studentWayForPhase = studentEstimatedPath.find((p) => p.phase === phase.phase)?.wayId;
              const isLastStudentNode = phase.phase === lastStudentPhase;
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
                  <div className="absolute left-[-29px] top-6 w-5 h-5 bg-white border-[3px] border-zinc-200 rounded-full z-10 flex items-center justify-center">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {phase.ways.map((way) => {
                      const isStudentTookThis = studentWayForPhase === way.way_id;
                      const isPrimary = way.is_primary;
                      const showBottleneck = isLastStudentNode && isStudentTookThis && !hasReachedGoal;

                      // Tailwind dynamic classes
                      let borderClass = 'border-zinc-200 bg-white shadow-sm hover:border-zinc-300';
                      let headerClass = 'text-zinc-800';
                      let badgeClass = 'bg-zinc-100 text-zinc-600';
                      
                      if (isPrimary && isStudentTookThis) {
                        // Best possible scenario: Student took the primary path
                        borderClass = 'border-emerald-500 bg-emerald-50 border-2 shadow-emerald-500/10 shadow-lg';
                        headerClass = 'text-emerald-900 font-bold';
                        badgeClass = 'bg-emerald-100 text-emerald-700';
                      } else if (isStudentTookThis) {
                        // Student took an alternative / wrong path
                        borderClass = 'border-red-400 bg-red-50 border-2 shadow-red-500/10 shadow-lg';
                        headerClass = 'text-red-900 font-bold';
                        badgeClass = 'bg-red-100 text-red-700';
                      } else if (isPrimary) {
                        // AI Recommended it, but student didn't take it
                        borderClass = 'border-emerald-300 border-2 border-dashed bg-white shadow-sm opacity-80';
                        headerClass = 'text-emerald-700 font-bold';
                        badgeClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                      } else {
                        // Other unexplored paths
                        borderClass = 'border-zinc-100 bg-zinc-50 opacity-50 grayscale';
                      }

                      return (
                        <div key={way.way_id} className={`relative rounded-2xl p-4 transition-all ${borderClass}`}>
                          
                          {/* Way Header */}
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
                              Way {way.way_id}
                            </span>
                            <div className="flex gap-1.5">
                              {isPrimary && !isStudentTookThis && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                                  <CheckCircle2 size={12} />
                                  Recommended
                                </span>
                              )}
                              {isStudentTookThis && (
                                <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${isPrimary ? 'text-emerald-600' : 'text-red-500'}`}>
                                  나의 경로
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
                              {way.concepts.map((concept, i) => (
                                <span key={i} className={`text-[10px] px-2 py-1 rounded bg-white/60 border border-white/80 shrink-0 ${isStudentTookThis && !isPrimary ? 'text-red-700 border-red-200 bg-red-100/50' : isPrimary ? 'text-emerald-700 border-emerald-200 bg-emerald-100/50' : 'text-zinc-500 border-zinc-200'}`}>
                                  {getConceptLabel(concept)}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Bottleneck Marker */}
                          {showBottleneck && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", bounce: 0.6 }}
                              className="absolute -right-3 -top-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 ring-4 ring-white"
                            >
                              <AlertCircle size={18} />
                            </motion.div>
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
      </div>
    </div>
  );
}
