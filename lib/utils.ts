import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 1. Tailwind CSS 클래스 병합 유틸리티 (핵심 기능)
 * clsx: 조건부로 클래스 이름을 적용해주는 기능 (예: `isActive && 'bg-blue-500'`)
 * twMerge: Tailwind 클래스가 충돌할 때 나중에 선언된 것을 우선 적용해주는 기능 (예: `p-2 p-4` -> `p-4`)
 * 
 * 컴포넌트 개발 시, 부모가 자식에게 className을 넘길 때 발생할 수 있는 의도치 않은 스타일 충돌을 막아줍니다.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 2. 날짜 포맷팅 유틸리티 (선택 기능)
 * date-fns를 활용하여 대화방 시간이나 날짜를 한국어("3분 전", "오후 2:30")로 예쁘게 표시합니다.
 */
export function formatTimeAgo(date: Date | string | number) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ko });
}

export function formatDateTime(date: Date | string | number) {
  return format(new Date(date), 'yyyy년 MM월 dd일 a h:mm', { locale: ko });
}
