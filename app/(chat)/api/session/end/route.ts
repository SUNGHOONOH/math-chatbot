// ============================================================
// AHA v5 — Route 3: 세션 종료 처리
// ============================================================
// 세션 상태를 completed/abandoned로 전환하고,
// after()를 사용하여 백그라운드에서 strategy_graphs의
// required_concepts를 지연 수집(Lazy Loading)합니다.
//
// ⚠️ intended_path, graph_data는 건드리지 않습니다 (야간 배치용).
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  updateSessionStatus,
  extractAndUpdateRequiredConcepts,
} from '@/lib/ai/ai-service';
import { after } from 'next/server';

export async function POST(req: Request) {
  try {
    const { sessionId, status } = await req.json();

    if (!sessionId || !status) {
      return NextResponse.json(
        { error: 'sessionId와 status가 필요합니다.' },
        { status: 400 }
      );
    }

    // 유효한 상태값인지 확인
    const validStatuses = ['completed', 'abandoned', 'viewed_answer'] as const;
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `유효하지 않은 상태: ${status}` },
        { status: 400 }
      );
    }

    // 1. 인증 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 2. 세션 소유권 확인 + problem_hash 가져오기
    const { data: session } = await supabase
      .from('tutoring_sessions')
      .select('id, student_id, problem_hash, session_status')
      .eq('id', sessionId)
      .single();

    if (!session || session.student_id !== user.id) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 3. 세션 상태 업데이트
    await updateSessionStatus(sessionId, status);

    // 4. 세션이 종료 상태로 전환될 때만 개념 추출 실행 (백그라운드)
    const isTerminal = status === 'completed' || status === 'abandoned';
    if (isTerminal) {
      after(async () => {
        console.log(`[session/end] 개념 추출 시작: ${sessionId} (${status})`);
        await extractAndUpdateRequiredConcepts({
          sessionId,
          problemHash: session.problem_hash,
        });
        console.log(`[session/end] 개념 추출 완료: ${sessionId}`);
      });
    }

    return NextResponse.json({
      success: true,
      sessionId,
      status,
      willExtractConcepts: isTerminal,
    });
  } catch (err) {
    console.error('[session/end] 에러:', err);
    return NextResponse.json(
      { error: '세션 종료 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
