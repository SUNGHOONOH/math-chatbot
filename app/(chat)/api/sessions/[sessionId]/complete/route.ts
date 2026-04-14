// ============================================================
// AHA v5 — 세션 완료/상태 전환 통합 API
// ============================================================
// /api/sessions/[sessionId]/complete 와 /api/session/end 를 통합합니다.
// 이전의 /api/session/end 는 이 route가 대체합니다.
//
// POST body: { status: 'completed' | 'viewed_answer' | 'abandoned' }
//   status 생략 시 기본값: 'completed'
//
// 세션 완료(리포트 생성)는 Lazy — 이 route는 절대 리포트를 생성하지 않습니다.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  completeSession,
  markViewedAnswer,
  abandonSession,
  type SessionStatus,
} from '@/lib/services/session-service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // body에서 전환할 상태 읽기 (기본값: completed)
  let targetStatus: SessionStatus = 'completed';
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.status) {
      const valid: SessionStatus[] = ['completed', 'viewed_answer', 'abandoned'];
      if (!valid.includes(body.status)) {
        return NextResponse.json({ error: `유효하지 않은 상태: ${body.status}` }, { status: 400 });
      }
      targetStatus = body.status;
    }
  } catch {
    // body 파싱 실패 → 기본값 completed 사용
  }

  let result: { success: boolean; error?: string; status?: number };

  switch (targetStatus) {
    case 'completed':
      result = await completeSession(sessionId, { studentId: user.id });
      break;
    case 'viewed_answer':
      result = await markViewedAnswer(sessionId, { studentId: user.id });
      break;
    case 'abandoned':
      result = await abandonSession(sessionId, { studentId: user.id });
      break;
    default:
      return NextResponse.json({ error: '잘못된 상태 전환 요청입니다.' }, { status: 400 });
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  console.log(`[sessions/complete] ${sessionId} → ${targetStatus}`);
  return NextResponse.json({ success: true, status: targetStatus });
}
