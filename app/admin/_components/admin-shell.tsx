'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Activity,
  Users,
  ShieldCheck,
  GraduationCap,
  Tags,
  BookOpen,
  MessageSquare,
  Cpu,
  PieChart,
  Target,
  DollarSign,
  Database,
  ArrowLeft
} from 'lucide-react';

const MENU_GROUPS = [
  {
    title: 'Overview',
    items: [
      { name: '대시보드', href: '/admin', icon: BarChart3, badge: '' },
      { name: '실시간 활동', href: '/admin/live', icon: Activity, badge: 'LIVE' },
    ],
  },
  {
    title: '사용자',
    items: [
      { name: '계정 관리', href: '/admin/users', icon: Users, badge: 'Profile' },
      { name: '튜터 관리', href: '/admin/tutors', icon: GraduationCap, badge: 'Tutor' },
    ],
  },
  {
    title: '데이터 관리',
    items: [
      { name: 'AI 병목진단 라벨링', href: '/admin/labeling', icon: Tags, badge: '' },
      { name: '개념 노드 · Alias', href: '/admin/knowledge', icon: BookOpen, badge: 'Concepts' },
      { name: '문제 은행', href: '/admin/problems', icon: Database, badge: 'Strategy' },
      { name: '세션 통계 및 분석', href: '/admin/analytics', icon: MessageSquare, badge: 'Insights' },
      { name: '모델 버전 관리', href: '/admin/models', icon: Cpu, badge: 'Model' },
    ],
  },
  {
    title: '분석 및 사업',
    items: [
      { name: 'KPI 대시보드', href: '/admin/kpi', icon: PieChart, badge: '' },
      { name: '풀이 버튼 분석', href: '/admin/hint-log', icon: Target, badge: 'NEW' },
      { name: '수익·정산', href: '/admin/revenue', icon: DollarSign, badge: 'NEW' },
      { name: 'MyData 관리', href: '/admin/mydata', icon: Database, badge: 'NEW' },
    ],
  },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white border-r border-zinc-200 shrink-0 md:h-screen md:sticky md:top-0 overflow-y-auto">
        <div className="p-6">
          <Link href="/chat/new" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-6 group">
            <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            채팅창으로
          </Link>
          <h2 className="text-xl font-bold bg-linear-to-r from-zinc-900 to-zinc-600 bg-clip-text text-transparent">
            AHA Admin
          </h2>
          <p className="text-xs text-zinc-500 mt-1 font-medium tracking-wide">BACKOFFICE PORTAL v5</p>
        </div>

        <nav className="px-4 pb-8 space-y-8">
          {MENU_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="px-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group',
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          size={18}
                          className={cn(
                            'transition-colors',
                            isActive ? 'text-blue-600' : 'text-zinc-400 group-hover:text-zinc-600'
                          )}
                        />
                        {item.name}
                      </div>
                      {item.badge && (
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide',
                          item.badge === 'LIVE' ? 'bg-red-100 text-red-600' :
                            item.badge === '핵심' || item.badge === '중요' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-600'
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-x-hidden relative">
        {children}
      </main>
    </div>
  );
}
