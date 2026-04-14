// ============================================================
// AHA v5 — 세션 리포트 API (Lazy Analysis)
// ============================================================
// report-service.getOrBuildSessionReport() 하나만 호출합니다.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrBuildSessionReport } from '@/lib/services/report-service';

export const maxDuration = 60;

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
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
