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
  ensureStrategyGraphExists,
  isPdfUrl,
  normalizeProblemText,
} from '@/lib/ai/ai-service';
import { createSession } from '@/lib/services/session-service';
import { extractTextFromPdf } from '@/lib/ai/pdf-service';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const {
      imageUrls = [],
      textInput = '',
      hasStudentConsent = false,
      fileType = '',
    } = await req.json();

    console.log('[problem/init] 요청 수신:', { hasImage: imageUrls.length > 0, hasText: !!textInput });

    // 0. 인증된 사용자 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 1. 이미지 OCR 또는 PDF 텍스트 추출
    let extractedText = '';

    if (imageUrls.length > 0) {
      const firstUrl = imageUrls[0];
      const isPdf = fileType === 'application/pdf' || isPdfUrl(firstUrl);

      if (isPdf) {
        // PDF 처리: Storage에서 다운로드 후 텍스트 추출
        console.log('[problem/init] PDF 분석 시작:', firstUrl);
        const res = await fetch(firstUrl);
        if (!res.ok) throw new Error(`PDF 파일을 다운로드할 수 없습니다. (상태: ${res.status})`);
        
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (buffer.length === 0) {
          throw new Error('PDF 파일이 비어 있습니다.');
        }

        extractedText = await extractTextFromPdf(buffer);
        console.log('[problem/init] PDF 텍스트 추출 완료');
      } else {
        // 기존 이미지 OCR 처리
        console.log('[problem/init] 이미지 OCR 분석 시작');
        extractedText = await performOCR(imageUrls);
        console.log('[problem/init] 이미지 OCR 분석 완료');
      }
    } else {
      extractedText = normalizeProblemText(textInput);
    }

    if (!extractedText) {
      return NextResponse.json({ error: '문제를 읽어내는 데 실패했습니다. (텍스트를 찾을 수 없음)' }, { status: 400 });
    }

    // 2. 문제 해시 생성 및 전략 그래프 탐색
    const problemHash = generateProblemHash(extractedText);
    await ensureStrategyGraphExists(problemHash);
    const strategyGraph = await getStrategyGraph(problemHash);

    // 3. 새 세션 자동 생성 (session-service를 통해 단일 활성 세션 불변식 유지)
    const sessionId = await createSession({
      studentId: user.id,
      problemHash,
      extractedText,
      hasStudentConsent: Boolean(hasStudentConsent),
    });

    console.log('[problem/init] 세션 생성 완료:', sessionId);

    // 4. 결과 리턴
    return NextResponse.json({
      sessionId,
      problemHash,
      extractedText,
      hasStrategyGraph: !!strategyGraph,
      strategyGraph: strategyGraph?.graph_data || null,
      isHumanVerified: strategyGraph?.is_human_verified || false,
    });
  } catch (err: any) {
    console.error('[problem/init] 치명적 에러:', err);

    const message = err?.message || '알 수 없는 서버 에러';
    const isTimeout = typeof message === 'string' && message.includes('시간 초과');

    return NextResponse.json({
      error: isTimeout ? '문제 인식 시간이 초과되었습니다.' : '초기화 중 오류가 발생했습니다.',
      details: isTimeout
        ? '사진 인식이 지연되고 있습니다. 같은 사진으로 다시 시도해 주세요.'
        : message,
    }, { status: isTimeout ? 504 : 500 });
  }
}
