'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Send, ImagePlus, X, Loader2, FileText, Square } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/lib/store/use-chat-store';
import { PendingSessionAction } from '@/types/chat';
import { createClientId } from '@/lib/client-id';
import { MathInputPanel } from './math-input-panel';
import { SimpleCalculator } from './simple-calculator';

// 어떤 패널이 열려있는지 (null = 닫힘)
type PanelMode = 'math' | 'calc' | null;

export function ChatInputArea() {
  const router = useRouter();
  const {
    input,
    setInput,
    imageFile,
    setImage,
    imagePreview,
    clearImage,
    isUploading,
    isInitializing,
    status,
    currentSessionId,
    messages,
    uploadImage,
    initProblemSession,
    streamResponse,
    stopStreaming,
  } = useChatStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const composerFormRef = useRef<HTMLFormElement>(null);
  const submitLockRef = useRef(false);
  const isLoading = status === 'streaming' || status === 'submitted';

  // 패널 상태
  const [panel, setPanel] = useState<PanelMode>(null);
  // 수식 패널 내 LaTeX 상태 (패널 닫아도 유지)
  const [mathLatex, setMathLatex] = useState('');
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateKeyboardOffset = () => {
      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset(offset > 80 ? offset : 0);
    };

    updateKeyboardOffset();
    viewport.addEventListener('resize', updateKeyboardOffset);
    viewport.addEventListener('scroll', updateKeyboardOffset);

    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset);
      viewport.removeEventListener('scroll', updateKeyboardOffset);
    };
  }, []);

  const togglePanel = (mode: PanelMode) => {
    setPanel((cur) => (cur === mode ? null : mode));
  };

  // 수식 패널 → 채팅 삽입
  const handleMathInsert = () => {
    if (!mathLatex.trim()) return;
    const separator = input.trim() ? ' ' : '';
    setInput(input + separator + `$${mathLatex}$`);
    setPanel(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === 'application/pdf') {
      setImage(file, 'pdf-placeholder');
    } else {
      const reader = new FileReader();
      reader.onloadend = () => setImage(file, reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const dataUrlToFile = async (dataUrl: string, fileName: string): Promise<File> => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
  };

  const handleImageButtonClick = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await CapacitorCamera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });

        if (!photo.dataUrl) return;

        const extension = photo.format || 'jpeg';
        const file = await dataUrlToFile(photo.dataUrl, `camera-${Date.now()}.${extension}`);
        setImage(file, photo.dataUrl);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.toLowerCase().includes('cancel')) {
          console.warn('[chat-input] native camera failed:', err);
        }
        return;
      }
    }

    fileInputRef.current?.click();
  }, [setImage]);

  useEffect(() => {
    const openCamera = () => {
      void handleImageButtonClick();
    };
    const openMath = () => setPanel('math');
    const focusInput = () => {
      textInputRef.current?.focus();
    };

    window.addEventListener('aha:open-camera', openCamera);
    window.addEventListener('aha:open-math', openMath);
    window.addEventListener('aha:focus-chat-input', focusInput);

    return () => {
      window.removeEventListener('aha:open-camera', openCamera);
      window.removeEventListener('aha:open-math', openMath);
      window.removeEventListener('aha:focus-chat-input', focusInput);
    };
  }, [handleImageButtonClick]);

  const persistPendingAction = (sessionId: string, action: PendingSessionAction) => {
    sessionStorage.setItem(`aha:pending-session-action:${sessionId}`, JSON.stringify(action));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !imageFile) return;
    if (submitLockRef.current || isLoading || isUploading || isInitializing) return;

    submitLockRef.current = true;

    setPanel(null);

    try {
      // 1. 세션 없는 경우 초기화
      if (!currentSessionId) {
        let imageUrl: string | undefined;
        if (imageFile) {
          const { url } = await uploadImage(imageFile);
          imageUrl = url;
        }

        const buildUserMessage = (text?: string, url?: string) => ({
          id: createClientId('user'),
          role: 'user' as const,
          parts: [
            ...(url ? [{ type: 'text' as const, text: `[첨부된 수학 문제 이미지]\n![수학 문제](${url})\n\n` }] : []),
            ...(text?.trim() ? [{ type: 'text' as const, text: text.trim() }] : []),
          ],
        });

        const initialUserMessage = buildUserMessage(input, imageUrl);
        const pendingAction: PendingSessionAction = input.trim()
          ? { type: 'first-message', message: initialUserMessage }
          : { type: 'kickoff', message: initialUserMessage };

        const { sessionId } = await initProblemSession({
          imageUrls: imageUrl ? [imageUrl] : [],
          fileType: imageFile?.type,
          textInput: input.trim(),
        });

        persistPendingAction(sessionId, pendingAction);
        setInput('');
        clearImage();
        router.replace(`/chat/${sessionId}`);
        return;
      }

      // 2. 기존 세션에 메시지 전송
      let imageUrl: string | undefined;
      if (imageFile) {
        const { url } = await uploadImage(imageFile);
        imageUrl = url;
      }

      const userMessage = {
        id: createClientId('user'),
        role: 'user' as const,
        parts: [
          ...(imageUrl ? [{ type: 'text' as const, text: `[첨부된 수학 문제 이미지]\n![수학 문제](${imageUrl})\n\n` }] : []),
          ...(input.trim() ? [{ type: 'text' as const, text: input.trim() }] : []),
        ],
      };

      const nextMessages = [...messages, userMessage];
      setInput('');
      clearImage();
      void streamResponse(currentSessionId, nextMessages);
    } catch (err) {
      console.error('세션 시작 실패:', err);
    } finally {
      submitLockRef.current = false;
    }
  };

  return (
    <div
      className="safe-bottom shrink-0 border-t border-zinc-200 bg-white/95 backdrop-blur transition-transform duration-200 ease-out"
      style={{ transform: keyboardOffset ? `translateY(-${keyboardOffset}px)` : undefined }}
    >
      {/* 이미지 미리보기 */}
      {imagePreview && (
        <div className="px-4 pt-3">
          <div className="relative inline-block">
            {imagePreview === 'pdf-placeholder' ? (
              <div className="h-24 px-6 flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-lg gap-2">
                <FileText size={24} className="text-zinc-500" />
                <span className="text-[10px] text-zinc-500 font-medium max-w-[100px] truncate">{imageFile?.name}</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="미리보기" className="h-24 rounded-lg object-cover border border-zinc-200" />
            )}
            <button
              onClick={clearImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 수식 입력 패널 */}
      {panel === 'math' && (
        <MathInputPanel
          latex={mathLatex}
          onChange={setMathLatex}
          onInsert={handleMathInsert}
          onClose={() => setPanel(null)}
        />
      )}

      {/* 계산기 패널 */}
      {panel === 'calc' && (
        <SimpleCalculator onClose={() => setPanel(null)} />
      )}

      {/* 입력 폼 */}
      <div className="px-3 py-2 sm:p-4">
        <form ref={composerFormRef} onSubmit={handleFormSubmit} className="mx-auto flex max-w-3xl items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* 이미지 업로드 */}
          <button
            type="button"
            onClick={handleImageButtonClick}
            disabled={isLoading || isInitializing}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors max-[380px]:h-10 max-[380px]:w-10',
              imageFile ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-zinc-100 text-zinc-400'
            )}
            title="사진 추가"
          >
            {Capacitor.isNativePlatform() ? <Camera size={20} /> : <ImagePlus size={20} />}
          </button>

          {/* 수식 입력 버튼 (ƒ) */}
          <button
            type="button"
            onClick={() => togglePanel('math')}
            disabled={isLoading || isInitializing}
            title="수식 입력"
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold leading-none transition-colors max-[380px]:h-10 max-[380px]:w-10',
              panel === 'math'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                : 'bg-zinc-100 text-zinc-500'
            )}
          >
            ƒ
          </button>

          {/* 계산기 버튼 (🟰) */}
          <button
            type="button"
            onClick={() => togglePanel('calc')}
            disabled={isLoading || isInitializing}
            title="계산기"
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] leading-none transition-colors max-[380px]:h-10 max-[380px]:w-10',
              panel === 'calc'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                : 'bg-zinc-100 text-zinc-500'
            )}
          >
            🟰
          </button>

          <div className="relative flex min-w-0 flex-1 items-center rounded-full bg-zinc-100/80 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/20">
            <input
              ref={textInputRef}
              type="text"
              className="min-h-12 min-w-0 flex-1 rounded-l-full border border-transparent bg-transparent py-3.5 pl-4 pr-2 text-[16px] text-zinc-900 outline-none placeholder:text-zinc-400 sm:py-4"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="문제나 막힌 지점을 입력..."
              disabled={isLoading || isInitializing}
            />

            {isLoading ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-colors animate-in fade-in duration-200 hover:bg-red-600"
                title="답변 생성 중지"
              >
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isLoading || isInitializing || (!input.trim() && !imageFile)}
                className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            )}
          </div>
        </form>

        <div className="mt-1 hidden items-center justify-center gap-3 text-center sm:flex">
          <span className="text-[11px] font-medium text-zinc-400">
            사진, PDF, 풀이 과정을 올리면 바로 이어서 도와드려요
          </span>
        </div>
      </div>
    </div>
  );
}
