// ============================================================
// AHA v5 — Auth Utilities
// ============================================================

import { User } from '@supabase/supabase-js';

export const LOGIN_PATH = '/login';
export const ONBOARDING_PATH = '/welcome';
export const DEFAULT_AUTH_REDIRECT_PATH = '/';
export const DEFAULT_POST_ONBOARDING_PATH = '/chat/new';

/**
 * 유저가 관리자인지 확인합니다.
 * 1. 서버가 기록한 app_metadata.role이 'admin'인 경우
 * 2. 서버 전용 ADMIN_EMAIL(하위 호환: NEXT_PUBLIC_ADMIN_EMAIL)과 이메일이 일치하는 경우
 */
export function isUserAdmin(user: User | null): boolean {
  if (!user) return false;

  const adminEmail = (
    process.env.ADMIN_EMAIL ??
    process.env.NEXT_PUBLIC_ADMIN_EMAIL
  )?.trim().toLowerCase();
  const userEmail = user.email?.trim().toLowerCase();

  // 1. 이메일 기반 체크 (Hardcoded Admin)
  if (adminEmail && userEmail && userEmail === adminEmail) {
    return true;
  }

  // 2. 메타데이터 기반 체크 (Dynamic Admin)
  // user_metadata는 사용자가 수정할 수 있으므로 권한 판별에 사용하지 않습니다.
  const role = user.app_metadata?.role?.toString().toLowerCase();
  return role === 'admin';
}

export function sanitizeRedirectPath(nextPath?: string | null): string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  try {
    const url = new URL(nextPath, 'http://localhost');
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }
}

export function buildLoginPath(nextPath?: string | null): string {
  const safeNextPath = sanitizeRedirectPath(nextPath);

  if (safeNextPath === DEFAULT_AUTH_REDIRECT_PATH) {
    return LOGIN_PATH;
  }

  const searchParams = new URLSearchParams({ next: safeNextPath });
  return `${LOGIN_PATH}?${searchParams.toString()}`;
}

export function buildOnboardingPath(nextPath?: string | null): string {
  const safeNextPath = sanitizeRedirectPath(nextPath);

  if (safeNextPath === ONBOARDING_PATH) {
    return ONBOARDING_PATH;
  }

  if (safeNextPath === DEFAULT_AUTH_REDIRECT_PATH) {
    return ONBOARDING_PATH;
  }

  const searchParams = new URLSearchParams({ next: safeNextPath });
  return `${ONBOARDING_PATH}?${searchParams.toString()}`;
}
