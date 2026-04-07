// ============================================================
// AHA v5 — Route 1: 문제 초기화 전용 API
// ============================================================
// 역할: 이미지 OCR → 텍스트 추출 → 문제 해시 → 전략 그래프 탐색
//       → 새 세션(tutoring_sessions) 자동 생성 → 클라이언트에 반환
// AGENTS.md §3-1, §7 (1 Problem = 1 Session) 준수
// ============================================================

import { NextResponse } from 'next/server';
import {
  performOCR,
  getStrategyGraph,
  generateProblemHash,
  createTutoringSession,
  ensureStrategyGraphExists,
  normalizeProblemText,
} from '@/lib/ai/ai-service';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { imageUrls = [], textInput = '', hasStudentConsent = false } = await req.json();

    // 0. 인증된 사용자 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 1. 이미지에서 텍스트 및 LaTeX 추출 (OCR)
    const extractedText = imageUrls.length > 0
      ? await performOCR(imageUrls)
      : normalizeProblemText(textInput);
    if (!extractedText) {
      return NextResponse.json({ error: '문제를 읽어내는 데 실패했습니다.' }, { status: 400 });
    }

    // 2. 문제 해시 생성 및 전략 그래프 탐색
    const problemHash = generateProblemHash(extractedText);
    await ensureStrategyGraphExists(problemHash);
    const strategyGraph = await getStrategyGraph(problemHash);

    // 3. 임시 이미지 삭제 (AI가 이미 분석 완료)
    if (imageUrls.length > 0) {
      const supabaseAdmin = getSupabaseAdmin();
      const paths = imageUrls.map((url: string) => {
        const parts = url.split('/chat-images/');
        return parts[parts.length - 1];
      });
      await supabaseAdmin.storage.from('chat-images').remove(paths);
      console.log('[problem/init] 임시 이미지 삭제 완료:', paths);
    }

    // 4. 새 세션 자동 생성 (1 Problem = 1 Session)
    const sessionId = await createTutoringSession({
      studentId: user.id,
      problemHash,
      extractedText,
      hasStudentConsent: Boolean(hasStudentConsent),
    });

    // 5. 결과 리턴
    return NextResponse.json({
      sessionId,
      problemHash,
      extractedText,
      hasStrategyGraph: !!strategyGraph,
      strategyGraph: strategyGraph?.graph_data || null,
      isHumanVerified: strategyGraph?.is_human_verified || false,
    });
  } catch (err) {
    console.error('[problem/init] 에러:', err);
    return NextResponse.json({ error: '초기화 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
