'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Bot, Send, User, ImagePlus, X, Loader2, LayoutDashboard } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useState, useRef, useEffect, useCallback } from 'react';
import posthog from 'posthog-js';
import { cn } from '@/lib/utils';
import { supabaseBrowser } from '@/lib/supabase/browser';
import Link from 'next/link';

// ============================================================
// 이미지 리사이즈 헬퍼 (Canvas API)
// ============================================================
// 최대 1200px로 줄이고 JPEG 80% 품질로 압축
// 수학 문제 글자를 읽는 데는 충분하며, 용량은 원본의 1/10~1/30 수준
// ============================================================
async function resizeImage(file: File, maxSize = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // 이미 작으면 그냥 반환
      if (width <= maxSize && height <= maxSize) {
        resolve(file);
        return;
      }

      // 비율 유지하며 축소
      if (width > height) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('리사이즈 실패'))),
        'image/jpeg',
        0.8
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ============================================================
// Supabase Storage 업로드 → 공개 URL 반환
// ============================================================
async function uploadImageToSupabase(file: File): Promise<{ url: string; path: string }> {
  const resized = await resizeImage(file);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const filePath = `uploads/${fileName}`;

  const { error } = await supabaseBrowser.storage
    .from('chat-images')
    .upload(filePath, resized, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);

  const { data } = supabaseBrowser.storage
    .from('chat-images')
    .getPublicUrl(filePath);

  return { url: data.publicUrl, path: filePath };
}

// ============================================================
// 메인 채팅 인터페이스
// ============================================================
export default function ChatInterface() {
  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const [input, setInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = status === 'streaming' || status === 'submitted';

  // 관리자 여부 확인
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (user && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        setIsAdmin(true);
      }
    };
    checkAdmin();
  }, []);

  // PostHog: 사고 시간 추적 (AI 응답 완료 → 사용자 타이핑 시작)
  const aiResponseTimeRef = useRef<number | null>(null);
  const thinkingTrackedRef = useRef(false);

  // AI 응답 완료 시점 기록
  useEffect(() => {
    if (status === 'ready' && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant') {
      aiResponseTimeRef.current = Date.now();
      thinkingTrackedRef.current = false;
    }
  }, [status, messages]);

  // 에러 발생 시 PostHog 기록
  useEffect(() => {
    if (error) {
      posthog.capture('ai_generation_error', {
        error_message: error.message,
        message_count: messages.length,
      });
    }
  }, [error, messages.length]);

  // 사용자 타이핑 시작 시 사고 시간 측정
  const trackThinkingTime = useCallback(() => {
    if (aiResponseTimeRef.current && !thinkingTrackedRef.current) {
      const thinkingMs = Date.now() - aiResponseTimeRef.current;
      thinkingTrackedRef.current = true;
      posthog.capture('student_thinking_time', {
        thinking_seconds: Math.round(thinkingMs / 1000),
        message_count: messages.length,
      });
    }
  }, [messages.length]);

  // PostHog: 포커스 이탈 감지
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        posthog.capture('focus_lost', {
          message_count: messages.length,
          was_loading: isLoading,
        });
      } else {
        posthog.capture('focus_returned', {
          message_count: messages.length,
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [messages.length, isLoading]);

  // 이미지를 선택했을 때 — 로컬 미리보기만 생성
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // 이미지 제거
  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 전송: 이미지 → Supabase 업로드 → URL을 텍스트로 AI에게 전달
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !imageFile) return;

    const parts: any[] = [];
    let imagePath: string | null = null;

    // 이미지가 있으면 Supabase에 업로드하고 URL을 전달
    if (imageFile) {
      setIsUploading(true);
      try {
        const { url, path } = await uploadImageToSupabase(imageFile);
        imagePath = path;

        // 이미지 URL을 AI가 이해하는 형식으로 전달
        parts.push({
          type: 'text',
          text: `[첨부된 수학 문제 이미지]\n![수학 문제](${url})\n\n`,
        });
      } catch (err: any) {
        console.error('이미지 업로드 실패:', err);
        alert('이미지 업로드에 실패했습니다. 다시 시도해주세요.');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    // 텍스트 part 추가
    if (input.trim()) {
      parts.push({ type: 'text', text: input });
    }

    // imagePath를 body에 같이 넘겨서 서버가 onFinish에서 삭제할 수 있게 함
    sendMessage({
      role: 'user',
      parts,
    } as any);

    // PostHog: 메시지 전송 이벤트
    posthog.capture('message_sent', {
      has_image: !!imagePath,
      message_length: input.trim().length,
      message_count: messages.length + 1,
    });

    setInput('');
    clearImage();
  };

  // 메시지 텍스트 추출 헬퍼
  const getMessageText = (msg: any): string => {
    if (typeof msg.content === 'string') return msg.content;
    if (msg.parts) {
      return msg.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('');
    }
    return '';
  };

  // 메시지에서 이미지 URL 추출 헬퍼
  const getMessageImages = (msg: any): string[] => {
    const text = getMessageText(msg);
    // Markdown 이미지 문법에서 URL 추출
    const regex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
    const urls: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      urls.push(match[1]);
    }
    // parts에 file type이 있으면 그것도 추가 (폴백)
    if (msg.parts) {
      for (const p of msg.parts) {
        if (p.type === 'file' && p.mimeType?.startsWith('image/')) {
          urls.push(p.data);
        }
      }
    }
    return urls;
  };

  // 이미지 URL을 제외한 순수 텍스트만 추출
  const getCleanText = (msg: any): string => {
    const text = getMessageText(msg);
    // Markdown 이미지와 [첨부된...] 라벨 제거
    return text
      .replace(/\[첨부된 수학 문제 이미지\]\n?/g, '')
      .replace(/!\[.*?\]\(https?:\/\/[^\s)]+\)\n*/g, '')
      .trim();
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto border-x border-zinc-200 bg-white shadow-xl shadow-zinc-100">
      {/* Header */}
      <div className="border-b px-6 py-4 bg-white/50 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AHA Socratic Tutor
          </h1>
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mt-0.5">
            Open Source AI · Vision + Math
          </span>
        </div>

        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all text-xs font-bold shadow-lg shadow-zinc-200"
          >
            <LayoutDashboard size={14} />
            대시보드
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <Bot size={32} />
            </div>
            <h2 className="text-2xl font-bold text-zinc-800">어떤 수학 문제를 도와줄까요?</h2>
            <p className="text-zinc-500 max-w-sm">
              수학 문제 사진을 찍어 올리거나, 텍스트로 질문해 주세요.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              <ImagePlus size={16} />
              문제 사진 올리기
            </button>
          </div>
        ) : (
          messages.map((m: any) => {
            const images = getMessageImages(m);
            const cleanText = m.role === 'user' ? getCleanText(m) : getMessageText(m);

            return (
              <div
                key={m.id}
                className={cn('flex gap-4', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {m.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Bot size={18} />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm overflow-x-auto',
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-white border border-zinc-100 text-zinc-800 rounded-tl-sm'
                  )}
                >
                  {/* 이미지 첨부 표시 */}
                  {m.role === 'user' && images.map((src: string, idx: number) => (
                    <img
                      key={idx}
                      src={src}
                      alt="수학 문제"
                      className="rounded-lg mb-3 max-h-64 object-contain"
                    />
                  ))}

                  {/* 텍스트 */}
                  {m.role === 'user' ? (
                    cleanText && (
                      <div className="whitespace-pre-wrap leading-relaxed text-[15px]">{cleanText}</div>
                    )
                  ) : (
                    <div className="prose prose-sm prose-zinc max-w-none text-[15px] leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {cleanText}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-zinc-200 text-zinc-600 flex items-center justify-center shrink-0">
                    <User size={18} />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-4 justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Bot size={18} />
            </div>
            <div className="bg-white border border-zinc-100 rounded-2xl rounded-tl-sm px-6 py-4 flex items-center gap-1 shadow-sm">
              <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce" />
            </div>
          </div>
        )}

        {/* 에러 상태 및 다시 시도 버튼 */}
        {error && (
          <div className="flex flex-col items-center gap-3 p-6 bg-red-50 rounded-2xl border border-red-100 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 text-red-600 font-medium whitespace-pre-wrap text-center text-sm">
              <X size={18} className="shrink-0" />
              <span>답변을 생성하는 중에 문제가 발생했습니다. (네트워크 혹은 서버 오류)</span>
            </div>
            <button
              onClick={() => regenerate()}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all text-sm font-bold shadow-lg shadow-red-600/20 active:scale-95"
            >
              <Loader2 size={16} className={cn(isLoading && "animate-spin")} />
              다시 시도하기
            </button>
          </div>
        )}
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 pt-3 bg-white border-t border-zinc-100">
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="업로드할 이미지"
              className="h-24 rounded-lg object-cover border border-zinc-200"
            />
            <button
              onClick={clearImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className={cn('p-4 bg-white', !imagePreview && 'border-t border-zinc-100')}>
        <form onSubmit={handleFormSubmit} className="relative max-w-3xl mx-auto flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              'p-2.5 rounded-full transition-colors shrink-0',
              imageFile
                ? 'bg-blue-100 text-blue-600'
                : 'bg-zinc-100 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200'
            )}
            title="수학 문제 사진 첨부"
          >
            <ImagePlus size={20} />
          </button>

          <input
            className="w-full bg-zinc-100/80 text-zinc-900 rounded-full pl-6 pr-14 py-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all border border-transparent focus:border-blue-200 placeholder:text-zinc-400"
            value={input}
            onChange={(e) => {
              trackThinkingTime();
              setInput(e.target.value);
            }}
            placeholder={imageFile ? '사진에 대해 질문하세요...' : '수학 문제를 입력해주세요...'}
            disabled={isLoading || isUploading}
          />

          <button
            type="submit"
            disabled={isLoading || isUploading || (!input.trim() && !imageFile)}
            className="absolute right-2 p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-md shadow-blue-600/20"
          >
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
        <div className="text-center mt-3">
          <span className="text-[11px] text-zinc-400 font-medium">
            📸 사진을 올리면 AI가 문제를 읽고 소크라틱 방식으로 도와줍니다
          </span>
        </div>
      </div>
    </div>
  );
}
