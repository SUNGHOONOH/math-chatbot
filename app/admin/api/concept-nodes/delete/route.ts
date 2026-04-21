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

    if (!isUserAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, concept_code } = await req.json();

    if (!id || !concept_code) {
      return NextResponse.json({ error: 'id와 concept_code가 필요합니다.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { error: aliasDeleteError } = await admin
      .from('concept_aliases')
      .delete()
      .eq('concept_code', concept_code);

    if (aliasDeleteError) {
      throw aliasDeleteError;
    }

    const { error: conceptDeleteError } = await admin
      .from('concept_nodes_reference')
      .delete()
      .eq('id', id);

    if (conceptDeleteError) {
      throw conceptDeleteError;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[AdminAPI] Concept Delete Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
