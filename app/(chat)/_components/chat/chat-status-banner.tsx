'use client';

import { Trophy, CheckCircle2, X, RefreshCw, MessageCircleQuestion } from 'lucide-react';
import { useChatStore } from '@/lib/store/use-chat-store';

export function ChatStatusBanner() {
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
    <div className="max-w-3xl mx-auto w-full space-y-3 px-4 py-2">
      {/* 1. 임시 공지/성공 알림 */}
      {pendingNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm text-emerald-700 animate-in fade-in duration-300">
          {pendingNotice}
        </div>
      )}

      {/* 3. 에러 발생 시 알림 */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
            <X size={18} />
            <span>{error.message}</span>
          </div>
          {lastSubmittedMessages && (
            <button
              type="button"
              onClick={retryLastMessage}
              disabled={isRetrying}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={13} />
              {isRetrying ? '생성 중...' : '다시 생성'}
            </button>
          )}
        </div>
      )}

      {resolutionCheckVisible && currentSessionId && !sessionCompleted && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <MessageCircleQuestion size={20} className="text-amber-700" />
            </div>
            <div>
              <p className="font-semibold text-amber-900 text-sm">문제가 해결되었나요?</p>
              <p className="text-xs text-amber-700 mt-0.5">해결됐다면 세션을 마무리하고 리포트를 볼 수 있습니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={dismissResolutionCheck}
              disabled={isCompletingSession}
              className="px-3 py-2 bg-white hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-xl border border-amber-200 transition-colors"
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
              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCompletingSession ? '처리 중...' : '네, 해결됐어요'}
            </button>
          </div>
        </div>
      )}

      {/* 4. 학습 완료 배너 (트로피) */}
      {sessionCompleted && currentSessionId && (
        <div className="p-4 bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <Trophy size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-emerald-800 text-sm">🎉 문제를 스스로 해결했어요!</p>
              <p className="text-xs text-emerald-600 mt-0.5">세션 리포트에서 학습 분석을 확인하세요.</p>
            </div>
          </div>
          <a
            href={`/chat/${currentSessionId}/report`}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            <CheckCircle2 size={13} />
            리포트 열기
          </a>
        </div>
      )}
    </div>
  );
}
