// ============================================================
// AHA v5 — Admin API: 미생성 임베딩 일괄 생성
// ============================================================
// concept_nodes_reference에서 embedding이 NULL인 노드를 찾아
// HuggingFace API로 벡터를 생성하고 UPDATE합니다.
// ============================================================

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/ai/ai-service';
import { isUserAdmin } from '@/lib/auth';

export const maxDuration = 60;

export async function POST() {
  // 1. 관리자 인증
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isUserAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    // 2. embedding이 NULL인 노드 전체 조회
    const { data: nodes, error: fetchError } = await admin
      .from('concept_nodes_reference')
      .select('id, concept_code, title, description')
      .is('embedding', null);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!nodes || nodes.length === 0) {
      return NextResponse.json({ success: true, generated: 0, message: '임베딩이 필요한 노드가 없습니다.' });
    }

    // 3. 각 노드에 대해 임베딩 생성 + UPDATE
    let successCount = 0;
    const errors: string[] = [];

    for (const node of nodes) {
      try {
        // title + description을 결합하여 임베딩 생성
        const textToEmbed = `${node.title}: ${node.description}`;
        const vector = await generateEmbedding(textToEmbed);

        const { error: updateError } = await admin
          .from('concept_nodes_reference')
          .update({ embedding: vector as any })
          .eq('id', node.id);

        if (updateError) {
          errors.push(`${node.concept_code}: ${updateError.message}`);
        } else {
          successCount++;
        }
      } catch (err: any) {
        errors.push(`${node.concept_code}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: nodes.length,
      generated: successCount,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
