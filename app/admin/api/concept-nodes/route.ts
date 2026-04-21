// ============================================================
// AHA v5 — Admin API: concept_nodes_reference upsert
// ============================================================

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isUserAdmin } from '@/lib/auth';

export async function POST(req: Request) {
  // 1. 관리자 인증
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isUserAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { nodes } = await req.json();
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json({ error: 'nodes 배열이 필요합니다.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('concept_nodes_reference')
      .upsert(
        nodes.map((n: any) => ({
          concept_code: n.concept_code,
          node_type: n.node_type || 'CU-PD',
          title: n.title || '',
          description: n.description || '',
          keywords: n.keywords || [],
          prerequisites: n.prerequisites || [],
          examples_of_use: n.examples_of_use || [],
        })),
        { onConflict: 'concept_code' }
      )
      .select('concept_code');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data?.length || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
