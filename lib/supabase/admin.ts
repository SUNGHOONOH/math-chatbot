import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../db/schema';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL 또는 Anon Key가 .env.local에 설정되지 않았습니다.');
}

const fallbackServerClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
const adminClient = supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey)
  : fallbackServerClient;

export function getSupabaseAdmin() {
  if (!supabaseServiceKey) {
    console.warn('Service Role Key가 없습니다. 일부 관리자 기능이 작동하지 않을 수 있습니다.');
  }

  return adminClient;
}
