'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  PanelLeftClose,
  PanelLeft,
  Plus,
  BarChart3,
  Shield,
  MessageSquare,
  Menu,
  X,
  CheckCircle2,
  Clock,
  Eye,
  LogOut,
} from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';

// ── 세션 아이템 타입 ──
export interface SessionItem {
  id: string;
  session_status: string;
  created_at: string;
  first_message?: string;
}

// ── 상태 아이콘 매핑 ──
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 size={14} className="text-emerald-500" />;
    case 'viewed_answer':
      return <Eye size={14} className="text-amber-500" />;
    case 'abandoned':
      return <LogOut size={14} className="text-zinc-400" />;
    default:
      return <Clock size={14} className="text-blue-500" />;
  }
}

export default function Sidebar({
  sessions,
  isAdmin = false,
}: {
  sessions: SessionItem[];
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // 모바일: 라우트 변경 시 자동으로 사이드바 닫기
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // 현재 활성 세션 ID 추출
  const activeSessionId = pathname.startsWith('/chat/')
    ? pathname.split('/chat/')[1]
    : null;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* ── 로고 + 접기 버튼 ── */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg shadow-emerald-500/20">
            A
          </div>
          {isOpen && (
            <span className="font-bold text-white tracking-tight text-base truncate">
              AHA Tutor
            </span>
          )}
        </div>
        {/* 데스크톱 접기 버튼 */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="hidden md:flex p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          {isOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>
        {/* 모바일 닫기 버튼 */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── 새 질문 버튼 ── */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/chat/new"
          className="flex items-center gap-2.5 w-full px-3.5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
        >
          <Plus size={18} />
          {isOpen && <span>새 질문</span>}
        </Link>
      </div>

      {/* ── 네비게이션 ── */}
      <nav className="px-3 py-2 space-y-1">
        <Link
          href="/dashboard"
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium ${pathname === '/dashboard'
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
            }`}
        >
          <BarChart3 size={18} />
          {isOpen && <span>학습 대시보드</span>}
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium ${pathname === '/admin'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
              }`}
          >
            <Shield size={18} />
            {isOpen && <span>관리자</span>}
          </Link>
        )}
      </nav>

      {/* ── 구분선 ── */}
      <div className="px-4 pt-2 pb-1">
        <div className="border-t border-zinc-800" />
        {isOpen && (
          <p className="text-[11px] text-zinc-600 font-semibold uppercase tracking-wider mt-3 px-1">
            대화 기록
          </p>
        )}
      </div>

      {/* ── 세션 히스토리 ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-800">
        {sessions.length === 0 ? (
          <div className="px-3 py-6 text-center">
            {isOpen && (
              <p className="text-zinc-600 text-xs">아직 대화 기록이 없습니다</p>
            )}
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = activeSessionId === session.id;
            const title = session.first_message
              ? session.first_message.slice(0, 30) + (session.first_message.length > 30 ? '...' : '')
              : `세션 ${session.id.slice(0, 8)}`;
            const date = new Date(session.created_at).toLocaleDateString('ko-KR', {
              month: 'short',
              day: 'numeric',
            });

            return (
              <Link
                key={session.id}
                href={`/chat/${session.id}`}
                className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-sm ${isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
              >
                <MessageSquare size={16} className="shrink-0" />
                {isOpen && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <StatusIcon status={session.session_status} />
                      <span className="truncate text-xs font-medium">
                        {title}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-600">{date}</span>
                  </div>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── 모바일 햄버거 버튼 ── */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-zinc-900 text-white rounded-lg shadow-lg"
      >
        <Menu size={20} />
      </button>

      {/* ── 모바일 오버레이 ── */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* ── 모바일 사이드바 ── */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {sidebarContent}
      </div>

      {/* ── 데스크톱 사이드바 ── */}
      <div
        className={`hidden md:flex flex-col shrink-0 transition-all duration-300 ease-out border-r border-zinc-800 ${isOpen ? 'w-64' : 'w-16'
          }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
