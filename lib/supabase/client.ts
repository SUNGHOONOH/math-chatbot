import { createClient } from '@supabase/supabase-js';
import type { Database } from '../db/schema';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL 또는 Anon Key가 .env.local에 설정되지 않았습니다.');
}

// 1. 클라이언트용 (브라우저에서 일반적인 조회용)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// 2. 서버용 (onSessionEnd 처럼 DB 권한이 많이 필요한 백엔드 작업용)
// 이 클라이언트는 오직 서버 컴포넌트나 API Route에서만 사용해야 합니다.
export const getSupabaseAdmin = () => {
  if (!supabaseServiceKey) {
    console.warn('Service Role Key가 없습니다. 일부 관리자 기능이 작동하지 않을 수 있습니다.');
    return supabase;
  }
  return createClient<Database>(supabaseUrl, supabaseServiceKey);
};
