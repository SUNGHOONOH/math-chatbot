// ============================================================
// AHA v5 — 브라우저(클라이언트) 전용 Supabase 클라이언트
// ============================================================
// 'use client' 컴포넌트에서 Storage 업로드 등에 사용합니다.
// NEXT_PUBLIC_ 접두사가 붙은 환경변수만 사용하므로 브라우저에서 안전합니다.
// ============================================================

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseBrowser = createBrowserClient(supabaseUrl, supabaseAnonKey);
