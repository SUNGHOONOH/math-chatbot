// ============================================================
// AHA v5 — Admin API: strategy_graphs verification toggle
// ============================================================

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { createClient } from '@/lib/supabase/server';
import { isUserAdmin } from '@/lib/auth';

export async function PATCH(req: Request) {
  // 1. 관리자 인증
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isUserAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { problemHash, isHumanVerified } = await req.json();
    if (!problemHash || typeof isHumanVerified !== 'boolean') {
      return NextResponse.json({ error: 'problemHash와 isHumanVerified가 필요합니다.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('strategy_graphs')
      .update({ is_human_verified: isHumanVerified })
      .eq('problem_hash', problemHash);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, problemHash, isHumanVerified });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
