import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';

export async function GET() {
  try {
    const supabase = await createClient();
    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('tutoring_sessions')
      .select('id, session_status, created_at, extracted_text')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('[api/sessions] 세션 목록 조회 실패:', error);
      return NextResponse.json({ error: '세션 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      sessions: (data || []).map((session) => ({
        id: session.id,
        session_status: session.session_status,
        created_at: session.created_at,
        first_message: session.extracted_text,
      })),
    });
  } catch (err) {
    console.error('[api/sessions] 치명적 에러:', err);
    return NextResponse.json({ error: '세션 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
