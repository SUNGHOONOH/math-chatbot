// ============================================================
// AHA v5 — /api/session/end (deprecated shim)
// ============================================================
// 이 경로는 /api/sessions/[sessionId]/complete 로 통합되었습니다.
// 이전 호출자(클라이언트)가 있을 경우를 위한 thin wrapper입니다.
// 새 코드에서는 이 경로를 사용하지 마세요.
// ============================================================

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { sessionId, status = 'completed' } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 });
  }

  // 새 통합 엔드포인트로 내부 위임
  const url = new URL(`/api/sessions/${sessionId}/complete`, req.url);
  const forwardRes = await fetch(url.toString(), {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ status }),
  });

  const data = await forwardRes.json();
  return NextResponse.json(data, { status: forwardRes.status });
}
