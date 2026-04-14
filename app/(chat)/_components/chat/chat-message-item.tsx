'use client';

import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types/chat';
import { MathErrorBoundary } from './math-error-boundary';

const PROBLEM_SOLVED_TOKEN = '[PROBLEM_SOLVED]';

interface ChatMessageItemProps {
  message: ChatMessage;
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

export function ChatMessageItem({ message }: ChatMessageItemProps) {
  const images = getMessageImages(message);
  const cleanText = message.role === 'user' ? getCleanUserText(message) : getMessageText(message);
  const assistantText = cleanText.replace(PROBLEM_SOLVED_TOKEN, '').trim();

  return (
    <div className={cn('flex gap-4', message.role === 'user' ? 'justify-end' : 'justify-start')}>
      {message.role !== 'user' && (
        <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
          <Bot size={18} />
        </div>
      )}

      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm overflow-x-auto',
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
          cleanText && <div className="whitespace-pre-wrap leading-relaxed text-[15px]">{cleanText}</div>
        ) : (
          <div className="prose prose-sm prose-zinc max-w-none text-[15px] leading-relaxed">
            <MathErrorBoundary key={assistantText} rawText={assistantText}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {assistantText}
              </ReactMarkdown>
            </MathErrorBoundary>
          </div>
        )}
      </div>

      {message.role === 'user' && (
        <div className="w-8 h-8 rounded-full bg-zinc-200 text-zinc-600 flex items-center justify-center shrink-0">
          <User size={18} />
        </div>
      )}
    </div>
  );
}
