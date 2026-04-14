// ============================================================
// AHA v5 — /chat/[sessionId]/report: 세션 리포트 페이지
// ============================================================
// completed 상태의 세션에서만 접근 가능합니다.
// 모든 데이터 로딩과 Lazy Analysis는 report-service에서 수행합니다.
// ============================================================

import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildLoginPath } from '@/lib/auth';
import Link from 'next/link';
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
  } catch (err: any) {
    if (err?.code === 'NOT_FOUND') notFound();
    if (err?.code === 'NOT_COMPLETED') redirect(`/chat/${sessionId}`);
    throw err; // 예상치 못한 오류는 Next.js error boundary로
  }

  const { session, analysis, dialogueLogs, bottlenecks } = report;
  const resolvedBottlenecks = bottlenecks.filter((b) => b.isResolved);
  const unresolvedBottlenecks = bottlenecks.filter((b) => !b.isResolved);

  const sessionDate = new Date(session.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const turnCount = Math.floor(dialogueLogs.length / 2);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
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

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* 상태 헤더 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-full">
              <CheckCircle2 size={12} />
              세션 완료
            </span>
            <span className="text-xs text-zinc-400">{sessionDate}</span>
          </div>
          <p className="text-zinc-700 text-sm leading-relaxed line-clamp-2">
            {session.extractedText?.slice(0, 120)}
            {(session.extractedText?.length ?? 0) > 120 ? '...' : ''}
          </p>
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

        {/* 필요 개념 */}
        {analysis.requiredConcepts.length > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={16} className="text-zinc-700" />
              <h2 className="font-semibold text-zinc-900 text-sm">이 문제에 필요한 개념</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.requiredConcepts.map((concept, i) => (
                <span key={i} className="px-3 py-1.5 bg-zinc-100 text-zinc-700 text-xs font-medium rounded-full">
                  {concept}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 병목 지점 */}
        {bottlenecks.length > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb size={16} className="text-zinc-700" />
              <h2 className="font-semibold text-zinc-900 text-sm">막혔던 지점 분석</h2>
            </div>
            <div className="space-y-3">
              {unresolvedBottlenecks.length > 0 && (
                <>
                  <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">미해결</p>
                  {unresolvedBottlenecks.map((b) => (
                    <div key={b.id} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-red-700">{b.conceptId}</p>
                        <p className="text-xs text-red-600 mt-0.5">{b.description}</p>
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
                        <p className="text-xs font-medium text-emerald-700">{b.conceptId}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">{b.description}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* 전체 대화 기록 */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={16} className="text-zinc-700" />
            <h2 className="font-semibold text-zinc-900 text-sm">전체 대화 기록</h2>
          </div>
          <div className="space-y-3">
            {dialogueLogs.map((log) => (
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
                <p className="leading-relaxed whitespace-pre-wrap">{log.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
