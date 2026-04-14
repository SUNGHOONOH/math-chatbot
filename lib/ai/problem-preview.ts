function unwrapEscapedLatex(text: string): string {
  return text.replace(/\\\\/g, '\\');
}

function normalizeBasePreviewText(problemText: string): string {
  const firstMeaningfulLine = problemText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? '';

  return unwrapEscapedLatex(firstMeaningfulLine)
    .replace(/\${1,2}/g, '')
    .replace(/sqrt\s*\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/sqrt\s*\{([^{}]+)\}/g, '\\sqrt{$1}')
    .replace(/\\left|\\right/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function protectMathSegments(text: string): string {
  const placeholders: string[] = [];

  const protect = (pattern: RegExp, source: string) =>
    source.replace(pattern, (match) => {
      const token = `__AHA_MATH_${placeholders.length}__`;
      placeholders.push(`$${match.trim()}$`);
      return token;
    });

  let result = text;

  result = protect(
    /\\(?:sin|cos|tan)\s*[A-Za-z](?:\s*=\s*.+?)?(?=(?:\s*(?:이고|일 때|이면|의\s*값|값은|를|은|는|,|\.|$)))/g,
    result
  );

  result = protect(
    /(?:\\frac\s*\{(?:[^{}]+|\\sqrt\s*\{[^{}]+\})+\}\s*\{(?:[^{}]+|\\sqrt\s*\{[^{}]+\})+\}|\\sqrt\s*\{[^{}]+\})(?=(?:\s*(?:이고|일 때|이면|의\s*값|값은|를|은|는|,|\.|$)))/g,
    result
  );

  return placeholders.reduce(
    (current, placeholder, index) => current.replace(`__AHA_MATH_${index}__`, placeholder),
    result
  );
}

export function formatProblemPreviewForChat(problemText: string): string {
  const normalized = protectMathSegments(normalizeBasePreviewText(problemText));

  if (!normalized) {
    return '방금 올린 수학 문제';
  }

  return normalized.slice(0, 120).trim();
}

export function formatProblemPreviewForTitle(problemText: string): string {
  const normalized = normalizeBasePreviewText(problemText)
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1/$2')
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, '√$1')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/[\{\}\$]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '세션 제목 없음';
  }

  return normalized.slice(0, 30).trim() + (normalized.length > 30 ? '...' : '');
}
