'use client';

import { Trophy, CheckCircle2, X, RefreshCw, MessageCircleQuestion } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/store/use-chat-store';

export function ChatStatusBanner() {
  const router = useRouter();
  const {
    sessionCompleted,
    currentSessionId,
    error,
    status,
    pendingNotice,
    retryLastMessage,
    lastSubmittedMessages,
    resolutionCheckVisible,
    dismissResolutionCheck,
    completeManualSession,
    isCompletingSession,
  } = useChatStore();
  const isRetrying = status === 'submitted' || status === 'streaming';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 bg-[#f7f8f6] px-4 py-2">
      {/* 1. 임시 공지/성공 알림 */}
      {pendingNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm text-emerald-700 animate-in fade-in duration-300">
          {pendingNotice}
        </div>
      )}

      {/* 3. 에러 발생 시 알림 */}
      {error && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
            <X size={18} />
            <span>{error.message}</span>
          </div>
          {lastSubmittedMessages && (
            <button
              type="button"
              onClick={retryLastMessage}
              disabled={isRetrying}
              className="flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={13} />
              {isRetrying ? '생성 중...' : '다시 생성'}
            </button>
          )}
        </div>
      )}

      {resolutionCheckVisible && currentSessionId && !sessionCompleted && (
        <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 animate-in fade-in duration-300 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <MessageCircleQuestion size={20} className="text-amber-700" />
            </div>
            <div>
              <p className="font-semibold text-amber-900 text-sm">문제가 해결되었나요?</p>
              <p className="text-xs text-amber-700 mt-0.5">해결됐다면 세션을 마무리하고 리포트를 볼 수 있습니다.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:shrink-0">
            <button
              type="button"
              onClick={dismissResolutionCheck}
              disabled={isCompletingSession}
              className="min-h-11 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
            >
              아니요
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await completeManualSession(currentSessionId);
                } catch (err) {
                  console.error('해결 여부 확인 완료 처리 에러:', err);
                }
              }}
              disabled={isCompletingSession}
              className="min-h-11 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCompletingSession ? '처리 중...' : '네, 해결됐어요'}
            </button>
          </div>
        </div>
      )}

      {/* 4. 학습 완료 배너 (트로피) */}
      {sessionCompleted && currentSessionId && (
        <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-linear-to-r from-emerald-50 to-teal-50 p-4 animate-in slide-in-from-bottom-2 duration-300 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <Trophy size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-emerald-800 text-sm">🎉 문제를 스스로 해결했어요!</p>
              <p className="text-xs text-emerald-600 mt-0.5">세션 리포트에서 학습 분석을 확인하세요.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/chat/${currentSessionId}/report`)}
            className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <CheckCircle2 size={13} />
            리포트 열기
          </button>
        </div>
      )}
    </div>
  );
}
