'use client';

import { useState } from 'react';
import { Camera, Send, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export function HeroChatInput({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [showModal, setShowModal] = useState(false);
  const [input, setInput] = useState('');
  const router = useRouter();

  const requestLoginOrOpenChat = () => {
    if (!isLoggedIn) {
      setShowModal(true);
      return;
    }

    router.push('/chat/new');
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!input.trim()) return;

    if (!isLoggedIn) {
      setShowModal(true);
    } else {
      router.push('/chat/new');
    }
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[640px] mx-auto mt-6 bg-white border border-zinc-200 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all relative overflow-hidden text-left group focus-within:ring-2 focus-within:ring-emerald-900/20"
      >
        <div className="px-6 pt-6 pb-20">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            className="block w-full resize-none bg-transparent text-lg font-medium leading-7 text-zinc-900 outline-none placeholder:text-zinc-400"
            placeholder="풀이가 막힌 지점을 입력하거나 문제 사진을 올려보세요..."
          />
        </div>
        
        <div className="absolute bottom-4 left-4 flex gap-1">
          <button
            type="button"
            onClick={requestLoginOrOpenChat}
            className="p-2.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors flex items-center justify-center"
            aria-label="사진으로 문제 올리기"
          >
            <Camera size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={requestLoginOrOpenChat}
            className="p-2.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors flex items-center justify-center"
            aria-label="이미지 파일로 문제 올리기"
          >
            <ImageIcon size={22} strokeWidth={2} />
          </button>
        </div>
        
        <div className="absolute bottom-4 right-4">
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-3 bg-zinc-900 text-white rounded-full hover:bg-zinc-800 transition-colors flex items-center justify-center group-hover:scale-105 duration-200 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="질문 보내기"
          >
            <Send size={20} className="ml-0.5" />
          </button>
        </div>
      </form>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-[360px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10">
            <div className="p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                 <span className="text-white font-black text-xl tracking-wider">AHA</span>
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">로그인 후 이용할 수 있어요</h3>
              <p className="text-[15px] text-zinc-500 mb-8 leading-relaxed">
                막힌 풀이를 이어가려면 로그인이 필요해요.<br/>지금 로그인하시겠어요?
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-2xl font-semibold transition-colors text-[15px]"
                >
                  취소
                </button>
                <button 
                  onClick={() => router.push('/login?next=/chat/new')}
                  className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-semibold transition-colors text-[15px]"
                >
                  로그인하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
