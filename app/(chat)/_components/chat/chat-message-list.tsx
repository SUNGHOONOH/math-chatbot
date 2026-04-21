'use client';

import { useEffect, useRef } from 'react';
import { Bot, Loader2 } from 'lucide-react';
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
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/50">
      {messages.length === 0 && !isInitializing ? (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Bot size={32} />
          </div>
          <h2 className="text-2xl font-bold text-zinc-800">어떤 수학 문제를 도와줄까요?</h2>
          <p className="text-zinc-500 max-w-sm">수학 문제 사진을 찍어 올리거나, 텍스트로 질문해 주세요.</p>
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
          <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
            <Bot size={18} />
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
