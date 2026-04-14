'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, ImagePlus, X, Loader2, FileText, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/lib/store/use-chat-store';
import { PendingSessionAction } from '@/types/chat';

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
    sessionCompleted,
    messages,
    hasStudentConsent,
    uploadImage,
    initProblemSession,
    streamResponse,
    stopStreaming,
    completeManualSession,
  } = useChatStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerFormRef = useRef<HTMLFormElement>(null);
  const isLoading = status === 'streaming' || status === 'submitted';

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

  const persistPendingAction = (sessionId: string, action: PendingSessionAction) => {
    sessionStorage.setItem(`aha:pending-session-action:${sessionId}`, JSON.stringify(action));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !imageFile) return;
    if (isLoading || isUploading || isInitializing) return;

    // 1. 세션 없는 경우 초기화
    if (!currentSessionId) {
      try {
        let imageUrl: string | undefined;
        if (imageFile) {
          const { url } = await uploadImage(imageFile);
          imageUrl = url;
        }

        const buildUserMessage = (text?: string, url?: string) => ({
          id: `user-${crypto.randomUUID()}`,
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
          hasStudentConsent,
        });

        persistPendingAction(sessionId, pendingAction);
        setInput('');
        clearImage();
        router.replace(`/chat/${sessionId}`);
      } catch (err) {
        console.error('세션 시작 실패:', err);
      }
      return;
    }

    // 2. 기존 세션에 메시지 전원
    let imageUrl: string | undefined;
    if (imageFile) {
      const { url } = await uploadImage(imageFile);
      imageUrl = url;
    }

    const userMessage = {
      id: `user-${crypto.randomUUID()}`,
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
  };

  return (
    <div className="bg-white">
      {imagePreview && (
        <div className="px-4 pt-3 border-t border-zinc-100">
          <div className="relative inline-block">
            {imagePreview === 'pdf-placeholder' ? (
              <div className="h-24 px-6 flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-lg gap-2">
                <FileText size={24} className="text-zinc-500" />
                <span className="text-[10px] text-zinc-500 font-medium max-w-[100px] truncate">{imageFile?.name}</span>
              </div>
            ) : (
              // 업로드 직후의 임시 미리보기 데이터 URL은 next/image 최적화 대상이 아니므로 일반 img를 사용합니다.
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

      <div className={cn('p-4', !imagePreview && 'border-t border-zinc-100')}>
        <form ref={composerFormRef} onSubmit={handleFormSubmit} className="relative max-w-3xl mx-auto flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isInitializing}
            className={cn(
              'p-2.5 rounded-full transition-colors shrink-0',
              imageFile ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-zinc-100 text-zinc-400'
            )}
          >
            <ImagePlus size={20} />
          </button>

          <input
            className="w-full bg-zinc-100/80 text-zinc-900 rounded-full pl-6 pr-14 py-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white border border-transparent transition-all placeholder:text-zinc-400"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="수학 문제를 입력하거나 사진을 올려주세요..."
            disabled={isLoading || isInitializing}
          />

          {isLoading ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="absolute right-2 p-2.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md transition-colors animate-in fade-in duration-200"
              title="답변 생성 중지"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading || isInitializing || (!input.trim() && !imageFile)}
              className="absolute right-2 p-2.5 bg-emerald-600 text-white rounded-full hover:bg-emerald-500 disabled:opacity-50 shadow-md transition-colors"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          )}
        </form>

        <div className="text-center mt-3 flex items-center justify-center gap-3">
          <span className="text-[11px] text-zinc-400 font-medium">
            📸 사진이나 📄 PDF를 올리면 AI와 공부를 시작할 수 있습니다
          </span>
          {currentSessionId && !sessionCompleted && (
            <button
              type="button"
              onClick={async () => {
                if (!currentSessionId) return;
                try {
                  await completeManualSession(currentSessionId);
                } catch (err) {
                  console.error('수동 완료 처리 에러:', err);
                }
              }}
              className="text-[11px] text-zinc-300 hover:text-zinc-500 underline underline-offset-2"
            >
              학습 완료로 표시
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
