'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { ChatInterfaceProps } from '@/types/chat';
import { useChatStore } from '@/lib/store/use-chat-store';
import { ChatMessageList } from './chat/chat-message-list';
import { ChatInputArea } from './chat/chat-input-area';
import { ChatStatusBanner } from './chat/chat-status-banner';

export default function ChatInterface({
  sessionId,
  initialMessages,
  initialSessionStatus,
}: ChatInterfaceProps = {}) {
  const { 
    resetSession, 
    messages, 
    status,
    currentSessionId,
    requestKickoff,
    streamResponse
  } = useChatStore();

  const isLoading = status === 'streaming' || status === 'submitted';

  // 1. 세션 초기화 및 상태 동기화
  useEffect(() => {
    resetSession(sessionId, initialMessages, initialSessionStatus);
  }, [sessionId, initialMessages, initialSessionStatus, resetSession]);

  // 2. 대화 이벤트 트래킹 (PostHog)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        posthog.capture('focus_lost', { 
          message_count: messages.length, 
          was_loading: isLoading 
        });
      } else {
        posthog.capture('focus_returned', { 
          message_count: messages.length 
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [messages.length, isLoading]);

  // 3. Pending Action 처리 (새 세션 시작 시 kickoff 등)
  useEffect(() => {
    if (!currentSessionId) return;

    const storageKey = `aha:pending-session-action:${currentSessionId}`;
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return;

    sessionStorage.removeItem(storageKey);
    try {
      const action = JSON.parse(raw);
      if (action.type === 'kickoff') {
        requestKickoff(currentSessionId, action.message);
      } else if (action.type === 'first-message' && action.message) {
        streamResponse(currentSessionId, [action.message]);
      }
    } catch (e) {
      console.error('Pending action parse error:', e);
    }
  }, [currentSessionId, requestKickoff, streamResponse]);

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* 1. 메시지 영역 */}
      <ChatMessageList />

      {/* 2. 상태 배너 영역 (완료 배너, 에러, 동의 등) */}
      <ChatStatusBanner />

      {/* 3. 입력 영역 */}
      <ChatInputArea />
    </div>
  );
}
