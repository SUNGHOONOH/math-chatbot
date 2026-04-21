'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatProblemPreviewForTitle } from '@/lib/ai/problem-preview';
import { buildLoginPath } from '@/lib/auth';
import {
  PanelLeftClose,
  PanelLeft,
  Plus,
  BarChart3,
  BarChart2,
  Shield,
  MessageSquare,
  Menu,
  X,
  CheckCircle2,
  Clock,
  Eye,
  LogOut,
} from 'lucide-react';

// ── 세션 아이템 타입 ──
export interface SessionItem {
  id: string;
  session_status: string;
  created_at: string;
  first_message?: string;
}

function getSessionTitle(session: SessionItem): string {
  if (!session.first_message) {
    return `세션 ${session.id.slice(0, 8)}`;
  }

  return formatProblemPreviewForTitle(session.first_message);
}

function getSessionDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

async function fetchSessionItems(): Promise<SessionItem[] | null> {
  const response = await fetch('/api/sessions', { cache: 'no-store' });
  if (response.status === 401 && typeof window !== 'undefined') {
    window.location.href = buildLoginPath(`${window.location.pathname}${window.location.search}`);
    return null;
  }
  if (!response.ok) return null;

  const data = await response.json();
  return Array.isArray(data.sessions) ? data.sessions : null;
}

// ── 세션 상태 뱃지 ──
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-semibold">
          <CheckCircle2 size={10} />
          완료
        </span>
      );
    case 'viewed_answer':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[10px] font-semibold">
          <Eye size={10} />
          답 확인
        </span>
      );
    case 'abandoned':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-400 text-[10px] font-semibold">
          <LogOut size={10} />
          중단
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-500 text-[10px] font-semibold">
          <Clock size={10} />
          진행중
        </span>
      );
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
  const [sessionItems, setSessionItems] = useState<SessionItem[]>(sessions);
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // 모바일: 라우트 변경 시 자동으로 사이드바 닫기
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setSessionItems(sessions);
  }, [sessions]);

  useEffect(() => {
    let cancelled = false;

    const loadSessions = async () => {
      const nextSessions = await fetchSessionItems();
      if (cancelled || !nextSessions) return;

      setSessionItems(nextSessions);
    };

    loadSessions();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // 현재 활성 세션 ID 추출
  const activeSessionId = pathname.startsWith('/chat/')
    ? pathname.split('/chat/')[1]
    : null;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#fcfcfc] text-zinc-900">
      {/* ── 로고 + 접기 버튼 ── */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg shadow-emerald-500/20">
            A
          </div>
          {isOpen && (
            <span className="font-bold text-zinc-900 tracking-tight text-base truncate">
              AHA Tutor
            </span>
          )}
        </div>
        {/* 데스크톱 접기 버튼 */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="hidden md:flex p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          {isOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>
        {/* 모바일 닫기 버튼 */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── 새 질문 버튼 ── */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/chat/new"
          prefetch={false}
          className="flex items-center gap-2.5 w-full px-3.5 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-zinc-900/10 active:scale-[0.98]"
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
              ? 'bg-zinc-100 text-zinc-900'
              : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
            }`}
        >
          <BarChart3 size={18} />
          {isOpen && <span>학습 대시보드</span>}
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium ${pathname === '/admin'
                ? 'bg-zinc-100 text-zinc-900'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
          >
            <Shield size={18} />
            {isOpen && <span>관리자</span>}
          </Link>
        )}
      </nav>

      {/* ── 구분선 ── */}
      <div className="px-4 pt-2 pb-1">
        <div className="border-t border-zinc-200" />
        {isOpen && (
          <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider mt-3 px-1">
            대화 기록
          </p>
        )}
      </div>

      {/* ── 세션 히스토리 ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-800">
        {sessionItems.length === 0 ? (
          <div className="px-3 py-6 text-center">
            {isOpen && (
              <p className="text-zinc-400 text-xs">아직 대화 기록이 없습니다</p>
            )}
          </div>
        ) : (
          sessionItems.map((session) => {
            const isActive = activeSessionId === session.id;
            const title = getSessionTitle(session);
            const date = getSessionDate(session.created_at);
            const itemClassName = `group flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-sm ${isActive
              ? 'bg-zinc-100 text-zinc-900'
              : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
              }`;

            return (
              <div key={session.id} className={itemClassName}>
                <Link
                  href={`/chat/${session.id}`}
                  prefetch={false}
                  className="flex items-center gap-2.5 min-w-0 flex-1"
                >
                  <MessageSquare size={16} className="shrink-0" />
                  {isOpen && (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-medium flex-1 min-w-0">
                          {title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StatusBadge status={session.session_status} />
                        <span className="text-[10px] text-zinc-400">{date}</span>
                      </div>
                    </div>
                  )}
                </Link>
                {isOpen && session.session_status === 'completed' && (
                  <Link
                    href={`/chat/${session.id}/report`}
                    prefetch={false}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 rounded-lg hover:bg-emerald-50 text-emerald-500 hover:text-emerald-600"
                    title="세션 리포트 보기"
                    aria-label="세션 리포트 보기"
                  >
                    <BarChart2 size={13} />
                  </Link>
                )}
              </div>
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
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white text-zinc-900 border border-zinc-200 rounded-lg shadow-lg"
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
        className={`hidden md:flex flex-col shrink-0 transition-all duration-300 ease-out border-r border-zinc-200 ${isOpen ? 'w-64' : 'w-16'
          }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
