'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, BarChart3, UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    href: '/chat/new',
    label: '홈',
    description: '메인',
    icon: House,
    matcher: (pathname: string) => pathname === '/' || pathname.startsWith('/chat'),
  },
  {
    href: '/dashboard',
    label: '나의 학습',
    description: '학습 현황',
    icon: BarChart3,
    matcher: (pathname: string) => pathname.startsWith('/dashboard'),
  },
  {
    href: '/profile',
    label: '프로필',
    description: '계정 정보',
    icon: UserCircle2,
    matcher: (pathname: string) => pathname.startsWith('/profile'),
  },
];

export function StudentNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2 overflow-x-auto">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.matcher(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'group inline-flex min-w-fit items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all',
              isActive
                ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm'
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900'
            )}
          >
            <Icon size={16} />
            <span>{item.label}</span>
            <span
              className={cn(
                'hidden text-xs md:inline',
                isActive ? 'text-zinc-300' : 'text-zinc-400 group-hover:text-zinc-500'
              )}
            >
              {item.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
