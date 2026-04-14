// ============================================================
// AHA v5 — /chat/new: 새로운 대화 시작 페이지
// ============================================================

import ChatInterface from '@/app/(chat)/_components/chat-interface';

export const metadata = {
  title: '새 질문 — AHA Tutor',
  description: '새로운 수학 문제를 풀어보세요',
};

export default function NewChatPage() {
  return <ChatInterface key="new-chat" />;
}
