// ============================================================
// AHA v5 — Supabase Edge Function: session-end
// ============================================================
// 역할: 대화 세션 종료 시 데이터를 각 테이블로 분배하고 리포트를 생성합니다.
// ============================================================

// @ts-ignore: Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore: Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      // @ts-ignore: Deno runtime
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno runtime
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { sessionId, studentId, messages, fullTranscript } = await req.json()

    console.log(`[session-end] 세션 종료 처리 중: ${sessionId}`)

    // 1. [Validations] 전체 원문 대화 저장
    const { error: validationError } = await supabaseClient
      .from('validations')
      .insert({
        session_id: sessionId,
        raw_transcript: fullTranscript || JSON.stringify(messages),
      })
    if (validationError) throw validationError

    // 2. [Operations/Chunks] 대화 5개 덩어리 분해 (추후 논의될 분류 id 체계 반영)
    // 예시: 0-20%, 20-40%, 40-60%, 60-80%, 80-100% 진행 상황 분동
    // 현재는 뼈대만 구축
    console.log('[session-end] Operations 데이터 분배 준비...')

    // 3. [Review Queue] LLM 생성 전략 그래프 등록 (Pending 상태)
    // 대화 내용을 바탕으로 새로운 그래프 패턴이 발견되었을 경우 등록
    // await supabaseClient.from('review_queue').insert({ ... })

    // 4. [Insight Agent] Huggingface 모델을 통한 3종 리포트 생성 (가이드)
    // ┌─ 학생용: 오늘 배운 개념 요약 및 격려
    // ├─ 튜터용: 학생의 막힌 부분 및 다음 학습 제언
    // └─ 학부모용: 학습 태도 및 성취도 요약
    console.log('[session-end] Insight Agent 리포트 생성 시작...')

    return new Response(
      JSON.stringify({ success: true, message: '세션 데이터 처리가 완료되었습니다.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error(`[session-end] 에러 발생: ${error.message}`)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
