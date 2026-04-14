import { create } from 'zustand';
import { 
  ChatMessage, 
  ChatStatus, 
  PendingSessionAction, 
  ChatTextPart 
} from '@/types/chat';
import { buildLoginPath } from '@/lib/auth';
import { supabaseBrowser } from '@/lib/supabase/browser';
import posthog from 'posthog-js';

// --- Utils (ChatInterface에서 가져옴) ---

const SESSION_ACTION_STORAGE_PREFIX = 'aha:pending-session-action:';
const PROBLEM_SOLVED_TOKEN = '[PROBLEM_SOLVED]';

function getPendingSessionActionKey(sessionId: string) {
  return `${SESSION_ACTION_STORAGE_PREFIX}${sessionId}`;
}

function getCurrentPathWithSearch() {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
}

function redirectToLoginPreservingCurrentPath() {
  if (typeof window === 'undefined') return;
  window.location.href = buildLoginPath(getCurrentPathWithSearch());
}

function makeTextMessage(id: string, role: 'user' | 'assistant', text: string): ChatMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
  };
}

function buildImageMessageText(url: string): string {
  return `[첨부된 수학 문제 이미지]\n![수학 문제](${url})`;
}

function buildUserMessage({ text, imageUrl }: { text?: string; imageUrl?: string }): ChatMessage {
  const parts: ChatTextPart[] = [];
  if (imageUrl) {
    parts.push({ type: 'text', text: `${buildImageMessageText(imageUrl)}\n\n` });
  }
  if (text?.trim()) {
    parts.push({ type: 'text', text: text.trim() });
  }
  return {
    id: `user-${crypto.randomUUID()}`,
    role: 'user',
    parts,
  };
}

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

// --- Store Interface ---

interface ChatState {
  // State
  messages: ChatMessage[];
  status: ChatStatus;
  error: Error | undefined;
  input: string;
  imagePreview: string | null;
  imageFile: File | null;
  isUploading: boolean;
  isInitializing: boolean;
  hasStudentConsent: boolean;
  consentError: string | null;
  pendingNotice: string | null;
  sessionCompleted: boolean;
  currentSessionId: string | undefined;
  
  // Internal refs-like state
  abortController: AbortController | null;
  lastSubmittedMessages: ChatMessage[] | null;
  
  // Actions
  setInput: (val: string) => void;
  setImage: (file: File | null, preview: string | null) => void;
  setConsent: (val: boolean) => void;
  resetSession: (sessionId?: string, initialMessages?: ChatMessage[], initialStatus?: string) => void;
  setSessionCompleted: (val: boolean) => void;
  
  // Async Actions
  uploadImage: (file: File) => Promise<{ url: string; path: string }>;
  initProblemSession: (payload: any) => Promise<{ sessionId: string }>;
  streamResponse: (sessionId: string, requestMessages: ChatMessage[]) => Promise<void>;
  requestKickoff: (sessionId: string, initialUserMessage?: ChatMessage) => Promise<void>;
  stopStreaming: () => void;
  clearImage: () => void;
  retryLastMessage: () => void;
  completeManualSession: (sessionId: string) => Promise<void>;
}

// --- Store Implementation ---

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial State
  messages: [],
  status: 'ready',
  error: undefined,
  input: '',
  imagePreview: null,
  imageFile: null,
  isUploading: false,
  isInitializing: false,
  hasStudentConsent: false,
  consentError: null,
  pendingNotice: null,
  sessionCompleted: false,
  currentSessionId: undefined,
  abortController: null,
  lastSubmittedMessages: null,

  // Simple Actions
  setInput: (input) => set({ input }),
  setImage: (imageFile, imagePreview) => set({ imageFile, imagePreview }),
  setConsent: (hasStudentConsent) => set({ hasStudentConsent }),
  setSessionCompleted: (sessionCompleted) => set({ sessionCompleted }),

  resetSession: (sessionId, initialMessages = [], initialStatus) => set({
    currentSessionId: sessionId,
    messages: initialMessages,
    status: 'ready',
    error: undefined,
    input: '',
    imagePreview: null,
    imageFile: null,
    isUploading: false,
    isInitializing: false,
    pendingNotice: null,
    sessionCompleted: initialStatus === 'completed',
  }),

  clearImage: () => set({ imageFile: null, imagePreview: null }),

  retryLastMessage: () => {
    const { currentSessionId, lastSubmittedMessages, streamResponse, status } = get();
    if (!currentSessionId || !lastSubmittedMessages) return;
    if (status === 'streaming' || status === 'submitted') return;
    set({ error: undefined });
    void streamResponse(currentSessionId, lastSubmittedMessages);
  },

  stopStreaming: () => {
    const { abortController, messages } = get();
    abortController?.abort();

    // 마지막 assistant 메시지가 빈 텍스트면 제거 (빈 버블 방지)
    const lastMsg = messages[messages.length - 1];
    const lastText = lastMsg?.parts?.map((p) => p.text).join('').trim() ?? '';
    const cleaned = (lastMsg?.role === 'assistant' && !lastText)
      ? messages.slice(0, -1)
      : messages;

    set({ status: 'ready', abortController: null, messages: cleaned });
  },

  // Async Actions
  uploadImage: async (file: File) => {
    set({ isUploading: true });
    try {
      const isPdf = file.type === 'application/pdf';
      const fileToUpload = isPdf ? file : await resizeImage(file);
      const extension = isPdf ? 'pdf' : 'jpg';
      const contentType = isPdf ? 'application/pdf' : 'image/jpeg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
      const filePath = `uploads/${fileName}`;

      const { error } = await supabaseBrowser.storage
        .from('chat-images')
        .upload(filePath, fileToUpload, { contentType, upsert: false });

      if (error) throw new Error(`파일 업로드 실패: ${error.message}`);

      const { data } = supabaseBrowser.storage.from('chat-images').getPublicUrl(filePath);
      return { url: data.publicUrl, path: filePath };
    } finally {
      set({ isUploading: false });
    }
  },

  initProblemSession: async (payload: any) => {
    set({ isInitializing: true });
    try {
      const response = await fetch('/api/problem/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        redirectToLoginPreservingCurrentPath();
        throw new Error('로그인이 필요합니다.');
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.details || data.error || '세션 초기화 실패');
      }
      return response.json();
    } finally {
      set({ isInitializing: false });
    }
  },

  requestKickoff: async (sessionId, initialUserMessage) => {
    set({ isInitializing: true, error: undefined });
    if (initialUserMessage) set({ messages: [initialUserMessage] });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          kickoff: true,
          messages: initialUserMessage ? [initialUserMessage] : [],
        }),
      });

      if (res.status === 401) {
        redirectToLoginPreservingCurrentPath();
        throw new Error('로그인이 필요합니다.');
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.details || data.error || '초기 질문 생성 실패');
      }

      const data = await res.json();
      const assistantMessage = typeof data.message === 'string' ? data.message.trim() : '';
      if (!assistantMessage) throw new Error('초기 소크라틱 질문이 비어 있습니다.');

      set((state) => ({
        messages: [
          ...state.messages,
          makeTextMessage(`assistant-kickoff-${sessionId}`, 'assistant', assistantMessage),
        ],
        status: 'ready',
      }));
    } catch (err: any) {
      set({ status: 'error', error: err instanceof Error ? err : new Error('첫 질문 생성 실패') });
    } finally {
      set({ isInitializing: false });
    }
  },

  streamResponse: async (sessionId, requestMessages) => {
    const assistantId = `assistant-${crypto.randomUUID()}`;
    const assistantPlaceholder = makeTextMessage(assistantId, 'assistant', '');
    
    set({ 
      messages: [...requestMessages, assistantPlaceholder],
      status: 'submitted',
      error: undefined,
      lastSubmittedMessages: requestMessages
    });

    const controller = new AbortController();
    set({ abortController: controller });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages: requestMessages }),
        signal: controller.signal,
      });

      if (response.status === 401) {
        redirectToLoginPreservingCurrentPath();
        throw new Error('로그인이 필요합니다.');
      }

      if (!response.ok) {
        throw new Error(await response.text() || '대화 생성에 실패했습니다.');
      }

      if (!response.body) throw new Error('응답 스트림이 비어 있습니다.');

      set({ status: 'streaming' });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('0:')) continue;
          try {
            assistantText += JSON.parse(trimmed.slice(2));
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantId ? makeTextMessage(assistantId, 'assistant', assistantText) : m
              ),
            }));
          } catch {}
        }
      }

      set({ status: 'ready', abortController: null });

      // [PROBLEM_SOLVED] 토큰 감지 → API 호출 후 DB 확인 시에만 sessionCompleted 설정
      if (assistantText.includes(PROBLEM_SOLVED_TOKEN) && !get().sessionCompleted) {
        try {
          const res = await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' });
          if (res.ok) {
            set({ sessionCompleted: true });
          }
        } catch (err) {
          console.error('[store] 세션 완료 호출 실패:', err);
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      set({ 
        messages: requestMessages, 
        status: 'error', 
        error: err instanceof Error ? err : new Error('대화 생성 중 오류 발생'),
        abortController: null
      });
    }
  },

  completeManualSession: async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (res.ok) {
        set({ sessionCompleted: true });
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '세션 완료 처리 실패');
      }
    } catch (err) {
      console.error('[store] 수동 세션 완료 실패:', err);
      throw err;
    }
  },
}));
