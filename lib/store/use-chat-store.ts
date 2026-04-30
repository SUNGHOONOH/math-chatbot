import { create } from 'zustand';
import { 
  ChatMessage, 
  ChatStatus 
} from '@/types/chat';
import { buildLoginPath } from '@/lib/auth';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { RESOLUTION_CHECK_MIN_EXCHANGES } from '@/lib/constants';
import { createClientId } from '@/lib/client-id';

// --- Utils (ChatInterface에서 가져옴) ---

const inFlightProblemInitRequests = new Set<string>();
const inFlightKickoffRequests = new Set<string>();
const inFlightStreamRequests = new Set<string>();
const inFlightCompletionRequests = new Set<string>();

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

function getMessageText(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
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

function countCompletedExchanges(messages: ChatMessage[]): number {
  const userTurns = messages.filter((message) => message.role === 'user' && getMessageText(message)).length;
  const assistantTurns = messages.filter((message) => message.role === 'assistant' && getMessageText(message)).length;
  return Math.min(userTurns, assistantTurns);
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
  pendingNotice: string | null;
  sessionCompleted: boolean;
  currentSessionId: string | undefined;
  resolutionCheckVisible: boolean;
  lastResolutionCheckExchangeCount: number;
  isCompletingSession: boolean;
  
  // Internal refs-like state
  abortController: AbortController | null;
  lastSubmittedMessages: ChatMessage[] | null;
  
  // Actions
  setInput: (val: string) => void;
  setImage: (file: File | null, preview: string | null) => void;
  resetSession: (sessionId?: string, initialMessages?: ChatMessage[], initialStatus?: string) => void;
  setSessionCompleted: (val: boolean) => void;
  dismissResolutionCheck: () => void;
  
  // Async Actions
  uploadImage: (file: File) => Promise<{ url: string; path: string }>;
  initProblemSession: (payload: { imageUrls?: string[]; fileType?: string; textInput?: string }) => Promise<{ sessionId: string }>;
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
  pendingNotice: null,
  sessionCompleted: false,
  currentSessionId: undefined,
  resolutionCheckVisible: false,
  lastResolutionCheckExchangeCount: 0,
  isCompletingSession: false,
  abortController: null,
  lastSubmittedMessages: null,

  // Simple Actions
  setInput: (input) => set({ input }),
  setImage: (imageFile, imagePreview) => set({ imageFile, imagePreview }),
  setSessionCompleted: (sessionCompleted) => set({ sessionCompleted }),
  dismissResolutionCheck: () =>
    set((state) => ({
      resolutionCheckVisible: false,
      lastResolutionCheckExchangeCount: countCompletedExchanges(state.messages),
    })),

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
    resolutionCheckVisible: false,
    lastResolutionCheckExchangeCount: 0,
    isCompletingSession: false,
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

  initProblemSession: async (payload) => {
    const requestKey = JSON.stringify({
      imageUrls: Array.isArray(payload?.imageUrls) ? payload.imageUrls : [],
      fileType: payload?.fileType ?? '',
      textInput: payload?.textInput ?? '',
    });
    if (inFlightProblemInitRequests.has(requestKey)) {
      throw new Error('세션 초기화 요청이 이미 진행 중입니다.');
    }

    inFlightProblemInitRequests.add(requestKey);
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
      inFlightProblemInitRequests.delete(requestKey);
      set({ isInitializing: false });
    }
  },

  requestKickoff: async (sessionId, initialUserMessage) => {
    if (inFlightKickoffRequests.has(sessionId)) return;
    inFlightKickoffRequests.add(sessionId);
    set({ isInitializing: true, error: undefined, resolutionCheckVisible: false });
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
        resolutionCheckVisible: false,
      }));
    } catch (err: unknown) {
      set({ status: 'error', error: err instanceof Error ? err : new Error('첫 질문 생성 실패') });
    } finally {
      inFlightKickoffRequests.delete(sessionId);
      set({ isInitializing: false });
    }
  },

  streamResponse: async (sessionId, requestMessages) => {
    if (inFlightStreamRequests.has(sessionId)) return;
    inFlightStreamRequests.add(sessionId);

    const assistantId = createClientId('assistant');
    const assistantPlaceholder = makeTextMessage(assistantId, 'assistant', '');
    
    set({ 
      messages: [...requestMessages, assistantPlaceholder],
      status: 'submitted',
      error: undefined,
      lastSubmittedMessages: requestMessages,
      resolutionCheckVisible: false,
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
            const visibleAssistantText = sanitizeAssistantText(assistantText);
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantId ? makeTextMessage(assistantId, 'assistant', visibleAssistantText) : m
              ),
            }));
          } catch {}
        }
      }

      set((state) => {
        const exchangeCount = countCompletedExchanges(state.messages);
        const shouldShowResolutionCheck =
          !state.sessionCompleted &&
          exchangeCount >= RESOLUTION_CHECK_MIN_EXCHANGES &&
          exchangeCount > state.lastResolutionCheckExchangeCount;

        return {
          status: 'ready',
          abortController: null,
          resolutionCheckVisible: shouldShowResolutionCheck,
          lastResolutionCheckExchangeCount: shouldShowResolutionCheck
            ? exchangeCount
            : state.lastResolutionCheckExchangeCount,
        };
      });

      // AI가 스스로 세션을 완료시키던 로직 제거 (사용자 직접 판단 및 수동 완료로 변경)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      set({ 
        messages: requestMessages, 
        status: 'error', 
        error: err instanceof Error ? err : new Error('대화 생성 중 오류 발생'),
        abortController: null
      });
    } finally {
      inFlightStreamRequests.delete(sessionId);
    }
  },

  completeManualSession: async (sessionId: string) => {
    if (inFlightCompletionRequests.has(sessionId)) return;
    inFlightCompletionRequests.add(sessionId);
    set({ isCompletingSession: true });
    try {
      const res = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (res.ok) {
        set({ sessionCompleted: true, resolutionCheckVisible: false });
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '세션 완료 처리 실패');
      }
    } catch (err) {
      console.error('[store] 수동 세션 완료 실패:', err);
      throw err;
    } finally {
      inFlightCompletionRequests.delete(sessionId);
      set({ isCompletingSession: false });
    }
  },
}));
