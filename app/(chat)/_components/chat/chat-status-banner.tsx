'use client';

import { Trophy, CheckCircle2, X, AlertCircle, RefreshCw } from 'lucide-react';
import { useChatStore } from '@/lib/store/use-chat-store';

export function ChatStatusBanner() {
  const {
    sessionCompleted,
    currentSessionId,
    hasStudentConsent,
    setConsent,
    consentError,
    error,
    pendingNotice,
    retryLastMessage,
    lastSubmittedMessages,
  } = useChatStore();

  return (
    <div className="max-w-3xl mx-auto w-full space-y-3 px-4 py-2">
      {/* 1. 데이터 수집 동의 (세션 시작 전) */}
      {!currentSessionId && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-zinc-700 space-y-3">
          <p className="font-semibold text-zinc-900">데이터 수집 동의</p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasStudentConsent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-[13px] leading-relaxed">
              내 대화 로그와 병목 데이터를 학습 진단 및 모델 개선에 활용하는 것에 동의합니다.
            </span>
          </label>
          {consentError && (
            <div className="flex items-center gap-1.5 text-red-600 text-[12px]">
              <AlertCircle size={12} />
              {consentError}
            </div>
          )}
        </div>
      )}

      {/* 2. 임시 공지/성공 알림 */}
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
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-lg transition-colors"
            >
              <RefreshCw size={13} />
              다시 생성
            </button>
          )}
        </div>
      )}

      {/* 4. 학습 완료 배너 (트로피) */}
      {sessionCompleted && currentSessionId && (
        <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2 duration-300">
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
            리포트 보기
          </a>
        </div>
      )}
    </div>
  );
}
