import { createRequire } from 'module';

/**
 * PDF Buffer에서 텍스트를 추출합니다.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // Next.js ESM 환경에서 CJS 모듈인 pdf-parse를 안정적으로 로드하기 위해 createRequire를 사용합니다.
    const require = createRequire(import.meta.url);
    const parsePdf = require('pdf-parse');

    // pdf-parse는 함수를 직접 export 하거나 default에 담고 있을 수 있습니다.
    const pdfFunc = typeof parsePdf === 'function' ? parsePdf : (parsePdf.default || parsePdf);

    if (typeof pdfFunc !== 'function') {
      console.error('[pdf-service] pdf-parse 로드 타입:', typeof parsePdf);
      throw new Error(`pdf-parse 라이브러리가 함수가 아닙니다. (타입: ${typeof parsePdf})`);
    }

    const data = await pdfFunc(buffer);
    return data.text.trim();
  } catch (error: any) {
    console.error('[pdf-service] PDF 텍스트 추출 중 상세 오류:', error);
    throw new Error(`PDF 파일 해석 실패: ${error?.message || '알 수 없는 이유'}`);
  }
}
