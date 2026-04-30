'use client';

import { useEffect, useRef } from 'react';
import { Camera, Loader2, MessageCircleQuestion } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChatStore } from '@/lib/store/use-chat-store';
import { ChatMessageItem } from './chat-message-item';

export function ChatMessageList() {
  const { messages, status, isInitializing } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === 'streaming' || status === 'submitted';

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="native-chat-scroll-pad flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none bg-[#f7f8f6] px-4 pb-4 sm:p-6 sm:pt-6 space-y-5 sm:space-y-6">
      {messages.length === 0 && !isInitializing ? (
        <div className="flex min-h-full flex-col items-center justify-center text-center">
          <div className="w-full max-w-md space-y-5">
            <div className="space-y-2">
              <h2 className="text-[26px] font-bold leading-tight tracking-normal text-zinc-950 sm:text-3xl">
                어디서 막혔는지 바로 시작해볼까요?
              </h2>
              <p className="mx-auto max-w-sm text-[15px] leading-6 text-zinc-500">
                문제 사진을 올리거나 풀이가 멈춘 지점을 적으면, 필요한 질문부터 이어갑니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('aha:open-camera'))}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-3 text-sm font-bold text-white shadow-sm active:scale-[0.99]"
              >
                <Camera size={17} />
                사진 찍기
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('aha:focus-chat-input'))}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-800 shadow-sm active:scale-[0.99]"
              >
                <MessageCircleQuestion size={17} />
                직접 입력
              </button>
            </div>
          </div>
        </div>
      ) : (
        messages.map((message, index) => {
          const isStreamingMessage =
            isLoading &&
            message.role === 'assistant' &&
            index === messages.length - 1;

          return (
            <ChatMessageItem
              key={message.id}
              message={message}
              isStreaming={isStreamingMessage}
            />
          );
        })
      )}

      {/* 로딩/스트리밍 중 바운싱 닷 표시 */}
      {isLoading && messages[messages.length - 1]?.role === 'user' && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex gap-4 justify-start"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-xs font-bold text-emerald-600 shadow-sm">
            A
          </div>
          <div className="bg-white border border-zinc-100 rounded-2xl rounded-tl-sm px-6 py-4 flex items-center gap-1 shadow-sm">
            <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" />
          </div>
        </motion.div>
      )}

      {/* 세션 초기화 로딩 */}
      {isInitializing && (
        <div className="flex items-center justify-center gap-3 p-6">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="text-sm text-zinc-500 font-medium">문제를 분석하고 있습니다...</span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
