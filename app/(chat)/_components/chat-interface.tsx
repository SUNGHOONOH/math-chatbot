'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Bot, Send, User, ImagePlus, X, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { cn } from '@/lib/utils';
import { supabaseBrowser } from '@/lib/supabase/browser';

// ============================================================
// Props 인터페이스: 새 대화 vs 기존 대화 복원을 구분합니다
// ============================================================
interface ChatInterfaceProps {
  sessionId?: string;          // 기존 세션 복원 시 전달
  initialMessages?: Array<{    // 기존 대화 복원 시 전달
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }>;
  extractedText?: string;      // 문제 원문 (기존 세션)
}

// ============================================================
// 이미지 리사이즈 헬퍼 (Canvas API)
// ============================================================
async function resizeImage(file: File, maxSize = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxSize && height <= maxSize) {
        resolve(file);
        return;
      }
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
export default function ChatInterface({
  sessionId: initialSessionId,
  initialMessages: serverMessages,
  extractedText: _initialExtractedText,
}: ChatInterfaceProps = {}) {
  const router = useRouter();

  // 세션 상태 관리
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(initialSessionId);
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasStudentConsent, setHasStudentConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [pendingProblemSavedNotice, setPendingProblemSavedNotice] = useState<string | null>(null);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<any | null>(null);

  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: {
        sessionId: currentSessionId,
      },
    }),
    messages: serverMessages as any,
  });

  const [input, setInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === 'streaming' || status === 'submitted';

  // 메시지 추가 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!currentSessionId || !pendingFirstMessage) return;
    sendMessage(pendingFirstMessage);
    setPendingFirstMessage(null);
  }, [currentSessionId, pendingFirstMessage, sendMessage]);

  // PostHog: 사고 시간 추적
  const aiResponseTimeRef = useRef<number | null>(null);
  const thinkingTrackedRef = useRef(false);

  useEffect(() => {
    if (status === 'ready' && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant') {
      aiResponseTimeRef.current = Date.now();
      thinkingTrackedRef.current = false;
    }
  }, [status, messages]);

  useEffect(() => {
    if (error) {
      posthog.capture('ai_generation_error', {
        error_message: error.message,
        message_count: messages.length,
      });
    }
  }, [error, messages.length]);

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
        posthog.capture('focus_lost', { message_count: messages.length, was_loading: isLoading });
      } else {
        posthog.capture('focus_returned', { message_count: messages.length });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [messages.length, isLoading]);

  // 이미지 선택 핸들러
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── 핵심: 첫 메시지 전송 시 세션 자동 생성 ──
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !imageFile) return;
    setConsentError(null);
    setPendingProblemSavedNotice(null);

    // 세션이 없는 경우 (새 대화): /api/problem/init 호출하여 세션 생성
    if (!currentSessionId && imageFile) {
      setIsInitializing(true);
      try {
        const { url } = await uploadImageToSupabase(imageFile);

        // /api/problem/init → 세션 생성 + OCR
        const initRes = await fetch('/api/problem/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrls: [url],
            hasStudentConsent,
          }),
        });

        if (!initRes.ok) {
          const errData = await initRes.json();
          alert(errData.error || '문제 초기화 실패');
          setIsInitializing(false);
          return;
        }

        const initData = await initRes.json();
        setCurrentSessionId(initData.sessionId);

        // URL을 /chat/[sessionId]로 갱신 (리로드 없이)
        router.replace(`/chat/${initData.sessionId}`);

        // 이미지+텍스트를 메시지로 전송
        const parts: any[] = [
          { type: 'text', text: `[첨부된 수학 문제 이미지]\n![수학 문제](${url})\n\n` },
        ];
        if (input.trim()) {
          parts.push({ type: 'text', text: input });
        }

        setPendingFirstMessage({ role: 'user', parts } as any);
        setInput('');
        clearImage();
        setIsInitializing(false);
        return;
      } catch (err) {
        console.error('세션 초기화 실패:', err);
        alert('세션 초기화에 실패했습니다.');
        setIsInitializing(false);
        return;
      }
    }

    // 세션이 없고 이미지도 없는 경우 (텍스트만): 간이 세션 생성
    if (!currentSessionId && !imageFile && input.trim()) {
      setIsInitializing(true);
      try {
        const initRes = await fetch('/api/problem/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrls: [],
            textInput: input.trim(),
            hasStudentConsent,
          }),
        });

        if (initRes.ok) {
          const initData = await initRes.json();
          setCurrentSessionId(initData.sessionId);
          router.replace(`/chat/${initData.sessionId}`);
          setPendingProblemSavedNotice('문제 원문을 세션에 저장했습니다. 이제 막힌 지점이나 현재 시도한 풀이를 적어 주세요.');
          setInput('');
          setIsInitializing(false);
          return;
        }
      } catch {
        console.warn('세션 생성 실패');
      }
      setIsInitializing(false);
      return;
    }

    // 일반 메시지 전송
    const parts: any[] = [];
    let imagePath: string | null = null;

    if (imageFile) {
      setIsUploading(true);
      try {
        const { url, path } = await uploadImageToSupabase(imageFile);
        imagePath = path;
        parts.push({ type: 'text', text: `[첨부된 수학 문제 이미지]\n![수학 문제](${url})\n\n` });
      } catch {
        alert('이미지 업로드에 실패했습니다.');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    if (input.trim()) {
      parts.push({ type: 'text', text: input });
    }

    sendMessage({ role: 'user', parts } as any);

    posthog.capture('message_sent', {
      has_image: !!imagePath,
      message_length: input.trim().length,
      message_count: messages.length + 1,
      session_id: currentSessionId,
    });

    setInput('');
    clearImage();
  };

  // ── 메시지 텍스트 추출 헬퍼 ──
  const getMessageText = (msg: any): string => {
    if (typeof msg.content === 'string') return msg.content;
    if (msg.parts) {
      return msg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
    }
    return '';
  };

  const getMessageImages = (msg: any): string[] => {
    const text = getMessageText(msg);
    const regex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
    const urls: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) { urls.push(match[1]); }
    if (msg.parts) {
      for (const p of msg.parts) {
        if (p.type === 'file' && p.mimeType?.startsWith('image/')) { urls.push(p.data); }
      }
    }
    return urls;
  };

  const getCleanText = (msg: any): string => {
    const text = getMessageText(msg);
    return text
      .replace(/\[첨부된 수학 문제 이미지\]\n?/g, '')
      .replace(/!\[.*?\]\(https?:\/\/[^\s)]+\)\n*/g, '')
      .trim();
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/50">
        {!currentSessionId && (
          <div className="max-w-3xl mx-auto bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-zinc-700 space-y-3">
            <p className="font-semibold text-zinc-900">세션 시작 전 데이터 수집 동의를 확인합니다.</p>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={hasStudentConsent}
                onChange={(e) => setHasStudentConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                내 대화 로그와 병목 데이터를 학습 진단 및 모델 개선에 활용하는 것에 동의합니다.
                동의하지 않아도 세션은 시작되며, 이 경우 학습용 데이터로는 사용되지 않습니다.
              </span>
            </label>
            {consentError && (
              <p className="text-xs text-red-600">{consentError}</p>
            )}
          </div>
        )}

        {pendingProblemSavedNotice && (
          <div className="max-w-3xl mx-auto bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-sm text-blue-700">
            {pendingProblemSavedNotice}
          </div>
        )}

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
                  {m.role === 'user' && images.map((src: string, idx: number) => (
                    <img key={idx} src={src} alt="수학 문제" className="rounded-lg mb-3 max-h-64 object-contain" />
                  ))}

                  {m.role === 'user' ? (
                    cleanText && <div className="whitespace-pre-wrap leading-relaxed text-[15px]">{cleanText}</div>
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

        {/* 초기화 중 로딩 */}
        {isInitializing && (
          <div className="flex items-center justify-center gap-3 p-6">
            <Loader2 size={20} className="animate-spin text-blue-500" />
            <span className="text-sm text-zinc-500 font-medium">문제를 분석하고 있습니다...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 p-6 bg-red-50 rounded-2xl border border-red-100">
            <div className="flex items-center gap-2 text-red-600 font-medium text-sm">
              <X size={18} className="shrink-0" />
              <span>답변을 생성하는 중에 문제가 발생했습니다.</span>
            </div>
            <button
              onClick={() => regenerate()}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all text-sm font-bold shadow-lg shadow-red-600/20 active:scale-95"
            >
              <Loader2 size={16} className={cn(isLoading && 'animate-spin')} />
              다시 시도하기
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 pt-3 bg-white border-t border-zinc-100">
          <div className="relative inline-block">
            <img src={imagePreview} alt="업로드할 이미지" className="h-24 rounded-lg object-cover border border-zinc-200" />
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
            disabled={isUploading || isInitializing}
            className={cn(
              'p-2.5 rounded-full transition-colors shrink-0',
              imageFile ? 'bg-blue-100 text-blue-600' : 'bg-zinc-100 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200'
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
              if (pendingProblemSavedNotice) {
                setPendingProblemSavedNotice(null);
              }
            }}
            placeholder={imageFile ? '사진에 대해 질문하세요...' : '수학 문제를 입력해주세요...'}
            disabled={isLoading || isUploading || isInitializing}
          />

          <button
            type="submit"
            disabled={isLoading || isUploading || isInitializing || (!input.trim() && !imageFile)}
            className="absolute right-2 p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-md shadow-blue-600/20"
          >
            {(isUploading || isInitializing) ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
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
