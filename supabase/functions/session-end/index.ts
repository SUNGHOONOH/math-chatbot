// ============================================================
// AHA v5 — Supabase Edge Function: session-end
// ============================================================
// 역할: 대화 세션 종료 시 리포트 생성용 집계 데이터를 수집합니다.
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

    const { sessionId } = await req.json()

    console.log(`[session-end] 세션 종료 처리 중: ${sessionId}`)

    const { data: session, error: sessionError } = await supabaseClient
      .from('tutoring_sessions')
      .select('id, session_status')
      .eq('id', sessionId)
      .maybeSingle()
    if (sessionError) throw sessionError

    const { data: logs, error: logsError } = await supabaseClient
      .from('dialogue_logs')
      .select('speaker, message_text, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    if (logsError) throw logsError

    const { data: bottlenecks, error: bottlenecksError } = await supabaseClient
      .from('learning_bottlenecks')
      .select('mapped_concept_id, struggle_description, is_resolved_by_student, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    if (bottlenecksError) throw bottlenecksError

    console.log('[session-end] 리포트 생성을 위한 집계 준비 완료', {
      sessionId,
      sessionStatus: session?.session_status,
      logCount: logs?.length ?? 0,
      bottleneckCount: bottlenecks?.length ?? 0,
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: '세션 리포트용 데이터 집계가 완료되었습니다.',
        sessionStatus: session?.session_status ?? null,
        logCount: logs?.length ?? 0,
        bottleneckCount: bottlenecks?.length ?? 0,
      }),
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
