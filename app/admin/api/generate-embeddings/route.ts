// ============================================================
// AHA v5 — Admin API: 미생성 임베딩 일괄 생성
// ============================================================
// concept_nodes_reference에서 embedding이 NULL인 노드를 찾아
// HuggingFace API로 벡터를 생성하고 UPDATE합니다.
// ============================================================

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
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

    // 2-1. embedding이 NULL인 Reference 노드 조회
    const { data: nodes, error: fetchError } = await admin
      .from('concept_nodes_reference')
      .select('id, concept_code, node_type, title, definition, description, keywords')
      .is('embedding', null);

    // 2-2. embedding이 NULL인 Alias 레코드 조회
    const { data: aliases, error: fetchAliasError } = await admin
      .from('concept_aliases')
      .select('id, concept_code, alias_text, failure_type')
      .is('embedding', null);

    if (fetchError || fetchAliasError) {
      console.error('[EmbeddingAPI] 데이터 조회 실패:', fetchError || fetchAliasError);
      return NextResponse.json({ error: fetchError?.message || fetchAliasError?.message }, { status: 500 });
    }

    const totalToProcess = (nodes?.length || 0) + (aliases?.length || 0);
    console.log(`[EmbeddingAPI] 작업 시작 - 대상: Reference(${nodes?.length}), Alias(${aliases?.length})`);

    if ((!nodes || nodes.length === 0) && (!aliases || aliases.length === 0)) {
      return NextResponse.json({ success: true, generated: 0, message: '임베딩이 필요한 데이터가 없습니다.' });
    }

    // 3. 각 레코드에 대해 임베딩 생성 + UPDATE
    let successCount = 0;
    const errors: string[] = [];

    // Reference 임베딩 생성
    for (const node of (nodes || [])) {
      try {
        // 공식 노드는 제목, 정의, 그리고 '진단 가이드(description)'가 핵심입니다.
        const keywordsStr = Array.isArray(node.keywords) ? node.keywords.join(', ') : '';
        const textToEmbed = `개념: ${node.title} (${node.concept_code}) | 정의: ${node.definition} | 진단 가이드: ${node.description} | 키워드: ${keywordsStr}`.trim();
        const vector = await generateEmbedding(textToEmbed, 'passage');

        const { error: updateError } = await admin
          .from('concept_nodes_reference')
          .update({ embedding: vector as any })
          .eq('id', node.id);

        if (updateError) {
          console.error(`[EmbeddingAPI] ID:${node.concept_code} DB 업데이트 실패:`, updateError.message);
          errors.push(`${node.concept_code}: ${updateError.message}`);
        } else {
          console.log(`[EmbeddingAPI] ✅ Reference(${node.concept_code}) 업데이트 성공`);
          successCount++;
        }
      } catch (err: any) {
        console.error(`[EmbeddingAPI] ❌ Reference(${node.concept_code}) 처리 중 예외:`, err.message);
        errors.push(`${node.concept_code}: ${err.message}`);
      }
    }

    // Alias 임베딩 생성
    for (const alias of (aliases || [])) {
      try {
        // 별칭은 학생의 실제 발화 표현(alias_text) 자체가 검색 쿼리와 가장 유사해야 합니다.
        const textToEmbed = `학생 표현: ${alias.alias_text} | 해당 개념: ${alias.concept_code}`.trim();
        const vector = await generateEmbedding(textToEmbed, 'passage');

        const { error: updateError } = await admin
          .from('concept_aliases')
          .update({ embedding: vector as any })
          .eq('id', alias.id);

        if (updateError) {
          console.error(`[EmbeddingAPI] Alias(${alias.concept_code}) 업데이트 실패:`, updateError.message);
          errors.push(`Alias(${alias.concept_code}): ${updateError.message}`);
        } else {
          console.log(`[EmbeddingAPI] ✅ Alias(${alias.concept_code}) 업데이트 성공`);
          successCount++;
        }
      } catch (err: any) {
        console.error(`[EmbeddingAPI] ❌ Alias(${alias.concept_code}) 처리 중 예외:`, err.message);
        errors.push(`Alias(${alias.concept_code}): ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      total_reference: nodes.length,
      total_alias: aliases.length,
      generated: successCount,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
