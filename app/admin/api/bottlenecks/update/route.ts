import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/ai/ai-service';
import { isUserAdmin } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * 관리자가 병목 진단 결과를 교정하고, 이를 concept_aliases에 반영하는 API
 */
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!isUserAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      bottleneckId, 
      mapped_concept_id, 
      failure_type, 
      syncToAlias 
    } = await req.json();

    const supabaseAdmin = getSupabaseAdmin();

    // 1. 기존 병목 데이터 조회 (Alias용 텍스트 확보를 위해)
    const { data: bottleneck, error: fetchError } = await bottleneckId 
      ? await supabaseAdmin
          .from('learning_bottlenecks')
          .select('*')
          .eq('id', bottleneckId)
          .single()
      : { data: null, error: new Error('ID is required') };

    if (fetchError || !bottleneck) {
      return NextResponse.json({ error: '병목 데이터를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. learning_bottlenecks 테이블 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('learning_bottlenecks')
      .update({
        mapped_concept_id: mapped_concept_id,
        failure_type: failure_type,
      })
      .eq('id', bottleneckId);

    if (updateError) throw updateError;

    // 3. concept_aliases에 지식으로 등록 (선택 사항)
    if (syncToAlias) {
      const { data: conceptNode } = await supabaseAdmin
        .from('concept_nodes_reference')
        .select('concept_code')
        .eq('concept_code', mapped_concept_id)
        .maybeSingle();

      if (!conceptNode) {
        return NextResponse.json({
          success: true,
          aliasSynced: false,
          warning: `concept_nodes_reference에 ${mapped_concept_id}가 없어 concept_aliases로 동기화하지 못했습니다.`,
        });
      }

      // 관리자가 교정한 설명이 이미 유사한 벡터 검색에 도움이 되도록 임베딩 생성 (저장용 'passage' 사용)
      const embedding = await generateEmbedding(bottleneck.struggle_description, 'passage');

      const { data: existingAlias } = await supabaseAdmin
        .from('concept_aliases')
        .select('id')
        .eq('concept_code', mapped_concept_id)
        .eq('alias_text', bottleneck.struggle_description)
        .maybeSingle();

      const aliasPayload = {
        concept_code: mapped_concept_id,
        alias_text: bottleneck.struggle_description,
        failure_type: failure_type,
        embedding: embedding,
      };

      const aliasMutation = existingAlias
        ? await supabaseAdmin
            .from('concept_aliases')
            .update(aliasPayload)
            .eq('id', existingAlias.id)
        : await supabaseAdmin
            .from('concept_aliases')
            .insert(aliasPayload);

      const aliasError = aliasMutation.error;

      if (aliasError) {
        console.error('[AdminAPI] Alias 동기화 실패:', aliasError);
        // 병목 수정은 성공했으므로 일단 진행 가능하지만, 로그는 남김
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[AdminAPI] 병목 수정 에러:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
