import ChatInterface from '@/components/chat/chat-interface';

export const metadata = {
  title: 'AHA Socratic Tutor',
  description: 'AI Math Tutor using Socratic questioning',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 border-zinc-200">
      <ChatInterface />
    </main>
  );
}
