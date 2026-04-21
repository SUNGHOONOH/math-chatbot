import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isUserAdmin } from '@/lib/auth';

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isUserAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const adminUserId = user.id;

    const { problem_hash } = await req.json();

    if (!problem_hash) {
      return NextResponse.json({ error: 'problem_hash가 필요합니다.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error: graphDeleteError } = await admin
      .from('strategy_graphs')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: adminUserId,
      })
      .eq('problem_hash', problem_hash);

    if (graphDeleteError) {
      throw graphDeleteError;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[AdminAPI] Strategy Graph Delete Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
