'use client';

import { Bot, User } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types/chat';
import { MathErrorBoundary } from './math-error-boundary';

interface ChatMessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

interface MarkdownMessageProps {
  text: string;
  className: string;
}

// Utils (ChatInterface에서 추출)
function getMessageText(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function getMessageImages(message: ChatMessage): string[] {
  const text = getMessageText(message);
  const regex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  const urls: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

function getCleanUserText(message: ChatMessage): string {
  return getMessageText(message)
    .replace(/\[첨부된 수학 문제 이미지\]\n?/g, '')
    .replace(/!\[.*?\]\(https?:\/\/[^\s)]+\)\n*/g, '')
    .trim();
}

function sanitizeAssistantText(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .replace(/\[PROBLEM_SOLVED\]/g, '')
    .replace(/\[BOTTLENECK:[^\]]*\]/g, '')
    .trim();
}

function MarkdownMessage({ text, className }: MarkdownMessageProps) {
  return (
    <div className={className}>
      <MathErrorBoundary key={text} rawText={text}>
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {text}
        </ReactMarkdown>
      </MathErrorBoundary>
    </div>
  );
}

export function ChatMessageItem({ message, isStreaming = false }: ChatMessageItemProps) {
  const images = getMessageImages(message);
  const cleanText = message.role === 'user' ? getCleanUserText(message) : getMessageText(message);
  const assistantText = sanitizeAssistantText(cleanText);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn('flex gap-2.5 sm:gap-4', message.role === 'user' ? 'justify-end' : 'justify-start')}
    >
      {message.role !== 'user' && (
        <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600 shadow-sm sm:flex">
          <Bot size={18} />
        </div>
      )}

      <div
        className={cn(
          'max-w-[92%] overflow-x-auto rounded-2xl px-4 py-3 shadow-sm sm:max-w-[85%] sm:px-5 sm:py-3.5',
          message.role === 'user'
            ? 'bg-zinc-900 text-white rounded-tr-sm'
            : 'bg-white border border-zinc-100 text-zinc-800 rounded-tl-sm'
        )}
      >
        {message.role === 'user' &&
          images.map((src, idx) => (
            // 채팅 첨부 이미지는 LLM 전달용으로 잠깐 생성한 Supabase public URL을 그대로 표시합니다.
            // 만료/삭제될 수 있는 임시 외부 자산이라 next/image 대신 일반 img를 의도적으로 사용합니다.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={idx} src={src} alt="수학 문제" className="rounded-lg mb-3 max-h-64 object-contain" />
          ))}

        {message.role === 'user' ? (
          cleanText && (
            <MarkdownMessage
              text={cleanText}
              className="prose prose-sm prose-invert max-w-none text-[15px] leading-relaxed [&_.katex]:text-white"
            />
          )
        ) : isStreaming ? (
          <div className="whitespace-pre-wrap leading-relaxed text-[15px] text-zinc-800">
            {assistantText}
          </div>
        ) : (
          <MarkdownMessage
            text={assistantText}
            className="prose prose-sm prose-zinc max-w-none text-[15px] leading-relaxed"
          />
        )}
      </div>

      {message.role === 'user' && (
        <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 sm:flex">
          <User size={18} />
        </div>
      )}
    </motion.div>
  );
}
