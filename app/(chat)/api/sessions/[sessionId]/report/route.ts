// ============================================================
// AHA v5 — 세션 리포트 API (Lazy Analysis)
// ============================================================
// report-service.getOrBuildSessionReport() 하나만 호출합니다.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrBuildSessionReport } from '@/lib/services/report-service';

export const maxDuration = 60;

function getErrorResponse(error: unknown) {
  const status =
    typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 500;
  const message =
    typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message
      : '리포트 생성 중 오류가 발생했습니다.';

  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const report = await getOrBuildSessionReport(sessionId, user.id);
    return NextResponse.json(report);
  } catch (err: unknown) {
    return getErrorResponse(err);
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const report = await getOrBuildSessionReport(sessionId, user.id, { forceRegenerate: true });
    return NextResponse.json(report);
  } catch (err: unknown) {
    return getErrorResponse(err);
  }
}
