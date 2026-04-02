import { NextResponse } from 'next/server';
import { performOCR, getStrategyGraph, generateProblemHash } from '@/lib/ai/ai-service';
import { getSupabaseAdmin } from '@/lib/supabase/client';

export async function POST(req: Request) {
  try {
    const { imageUrls = [], sessionId = `session-${Date.now()}` } = await req.json();

    // 1. [AHA v5 Stage 1] 이미지에서 텍스트 및 LaTeX 추출 (OCR)
    const extractedText = await performOCR(imageUrls);

    if (!extractedText) {
      return NextResponse.json({ error: '문제를 읽어내는 데 실패했습니다.' }, { status: 400 });
    }

    // 2. [AHA v5 Stage 1] 문제 해시 생성 및 전략 그래프 탐색
    const problemId = generateProblemHash(extractedText);
    const strategyGraph = await getStrategyGraph(problemId);

    // 3. [AHA v5 Stage 1] 임시 이미지 삭제 (AI가 이미 분석 완료했으므로)
    if (imageUrls.length > 0) {
      const supabaseAdmin = getSupabaseAdmin();
      const paths = imageUrls.map((url: string) => {
        const parts = url.split('/chat-images/');
        return parts[parts.length - 1];
      });
      await supabaseAdmin.storage.from('chat-images').remove(paths);
      console.log('[problem/init] 임시 이미지 삭제 완료:', paths);
    }

    // 4. 결과 리턴
    return NextResponse.json({
      sessionId,
      problemId,
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
