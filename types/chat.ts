// ============================================================
// AHA v5 — 채팅 관련 공용 타입 정의
// ============================================================

export interface ChatTextPart {
  type: 'text';
  text: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: ChatTextPart[];
}

export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error';

export type PendingSessionAction =
  | { type: 'kickoff'; message?: ChatMessage }
  | { type: 'first-message'; message: ChatMessage };

export interface ProblemInitResponse {
  sessionId: string;
}

export interface ChatInterfaceProps {
  sessionId?: string;
  initialMessages?: ChatMessage[];
  extractedText?: string;
  initialSessionStatus?: string;
}
