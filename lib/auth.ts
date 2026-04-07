// ============================================================
// AHA v5 — Auth Utilities
// ============================================================

import { User } from '@supabase/supabase-js';

/**
 * 유저가 관리자인지 확인합니다.
 * 1. 유저 메타데이터의 role이 'admin'인 경우
 * 2. 유저 이메일이 .env.local에 정의된 NEXT_PUBLIC_ADMIN_EMAIL과 일치하는 경우
 */
export function isUserAdmin(user: User | null): boolean {
  if (!user) return false;

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase();
  const userEmail = user.email?.trim().toLowerCase();

  // 1. 이메일 기반 체크 (Hardcoded Admin)
  if (adminEmail && userEmail && userEmail === adminEmail) {
    return true;
  }

  // 2. 메타데이터 기반 체크 (Dynamic Admin)
  const role = (user.app_metadata?.role || user.user_metadata?.role)?.toString().toLowerCase();
  return role === 'admin';
}
