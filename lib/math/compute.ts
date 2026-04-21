// ============================================================
// AHA v5 — MathLive ComputeEngine 래퍼 (클라이언트 전용)
// ============================================================
// simplify / evaluate / numeric 결과를 안전하게 반환합니다.
// 실패 시 앱이 깨지지 않도록 try-catch로 감쌉니다.
// ============================================================

export interface ComputeResult {
  simplified?: string;   // 대수적 단순화 결과
  evaluated?: string;    // 정확 계산 결과 (정수/유리수 등)
  numeric?: string;      // 근삿값 (소수)
  hasVariables?: boolean;
  error?: string;
}

export async function computeLatex(latex: string): Promise<ComputeResult> {
  if (!latex.trim()) return {};

  try {
    const { ComputeEngine } = await import('@cortex-js/compute-engine');
    const ce = new ComputeEngine();
    const expr = ce.parse(latex);

    // 자유 변수 존재 여부 확인
    const freeVars: string[] = (expr as any).freeVariables ?? [];
    const hasVariables = freeVars.length > 0;
    const result: ComputeResult = { hasVariables };

    // 1. 단순화 (항상 시도)
    try {
      const simplified = expr.simplify();
      const simplifiedLatex: string = (simplified as any).latex ?? '';
      if (simplifiedLatex && simplifiedLatex !== latex) {
        result.simplified = simplifiedLatex;
      }
    } catch { /* 단순화 실패는 무시 */ }

    // 2. 숫자식일 때만 exact + numeric 계산
    if (!hasVariables) {
      try {
        const evaluated = expr.evaluate();
        const evalLatex: string = (evaluated as any).latex ?? '';
        if (evalLatex && evalLatex !== latex) {
          result.evaluated = evalLatex;
        }
      } catch { /* 무시 */ }

      try {
        const numeric = (expr as any).N();
        const numLatex: string = (numeric as any).latex ?? '';
        if (
          numLatex &&
          !numLatex.includes('NaN') &&
          !numLatex.includes('Undefined') &&
          numLatex !== result.evaluated
        ) {
          result.numeric = numLatex;
        }
      } catch { /* 무시 */ }
    }

    return result;
  } catch (err) {
    // 파싱 자체가 실패하면 에러만 반환 (UI에서 조용히 처리)
    return { error: String(err) };
  }
}
