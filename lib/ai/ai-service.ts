import { VISION_MODEL, TAGGING_MODEL, EMBEDDING_MODEL } from './models';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { CHAT_CONTEXT_WINDOW_SIZE, RAG_SIMILARITY_THRESHOLD } from '@/lib/constants';
import crypto from 'crypto';
import type { Json } from '@/lib/db/schema';

const RAG_MATCH_COUNT = 3;
const DEFAULT_CHAT_MAX_TOKENS = 2048;
const HF_STREAM_DEBUG = process.env.HF_STREAM_DEBUG === '1';
const VALID_FAILURE_TYPES = new Set([
  'concept_gap',
  'misconception',
  'strategy_failure',
  'calculation_error',
  'condition_interpretation_failure',
]);

type StructuredResponseFormat =
  | { type: 'text' }
  | { type: 'json_object' }
  | {
    type: 'json_schema';
    json_schema: {
      name: string;
      description?: string;
      schema: Record<string, unknown>;
      strict?: boolean;
    };
  };

const gateResponseFormat: StructuredResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'bottleneck_gate',
    description: 'Determine whether the latest student turn should be sent to bottleneck tagging.',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['should_tag', 'focus_text', 'reason'],
      properties: {
        should_tag: { type: 'boolean' },
        focus_text: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  },
};

const diagnosisResponseFormat: StructuredResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'bottleneck_diagnosis',
    description: 'Return a validated bottleneck diagnosis JSON object.',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['selected_concept_code', 'failure_type', 'student_friendly_description', 'reason'],
      properties: {
        selected_concept_code: { type: 'string' },
        failure_type: {
          type: 'string',
          enum: Array.from(VALID_FAILURE_TYPES),
        },
        student_friendly_description: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  },
};

const requiredConceptsResponseFormat: StructuredResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'required_concepts',
    description: 'Return the required concept codes needed to solve the problem as JSON.',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['required_concepts', 'base_difficulty'],
      properties: {
        required_concepts: {
          type: 'array',
          items: { type: 'string' },
        },
        base_difficulty: {
          type: 'integer',
          minimum: 1,
          maximum: 5,
        },
      },
    },
  },
};

export const sessionInsightResponseFormat: StructuredResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'session_insight_report',
    description: 'Return a structured tutoring session report as JSON.',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['mastered_concepts', 'aha_moments', 'ai_tutor_summary', 'performance_metrics'],
      properties: {
        mastered_concepts: {
          type: 'array',
          items: { type: 'string' },
        },
        aha_moments: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['turn', 'node_id', 'utterance'],
            properties: {
              turn: { type: 'integer' },
              node_id: { type: 'string' },
              utterance: { type: 'string' },
            },
          },
        },
        ai_tutor_summary: { type: 'string' },
        performance_metrics: {
          type: 'object',
          additionalProperties: false,
          required: ['total_turns', 'ai_interventions', 'resolved_bottlenecks'],
          properties: {
            total_turns: { type: 'integer' },
            ai_interventions: { type: 'integer' },
            resolved_bottlenecks: { type: 'integer' },
          },
        },
      },
    },
  },
};

function getChatCompletionExtraBody(model: string): Record<string, unknown> | undefined {
  const isQwen3Family = model.startsWith('Qwen/Qwen3-') || model.startsWith('Qwen/Qwen3.5-');

  if (!isQwen3Family) {
    return undefined;
  }

  if (model.includes(':fireworks-ai')) {
    return { reasoning_effort: 'none' };
  }

  return { enable_thinking: false };
}

function isTaggingStructuredRequest(model: string, responseFormat?: StructuredResponseFormat): boolean {
  return Boolean(responseFormat) && model === TAGGING_MODEL;
}

function previewForLog(value: unknown, maxLength = 120): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function extractBalancedJsonValue(text: string, openChar: '{' | '['): string | null {
  const closeChar = openChar === '{' ? '}' : ']';
  const start = text.indexOf(openChar);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let stringQuote = '"';
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === stringQuote) {
        inString = false;
      }

      continue;
    }

    if (char === '"' || char === '\'') {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function extractBalancedJsonObject(text: string): string | null {
  return extractBalancedJsonValue(text, '{');
}

function extractBalancedJsonArray(text: string): string | null {
  return extractBalancedJsonValue(text, '[');
}

function repairJsonLikeString(text: string): string {
  return text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, '\'')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function escapeLikelyLatexBackslashes(text: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (!inString) {
      if (char === '"') {
        inString = true;
      }
      result += char;
      continue;
    }

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '"') {
      inString = false;
      result += char;
      continue;
    }

    if (char !== '\\') {
      result += char;
      continue;
    }

    const nextChar = text[i + 1] ?? '';

    if (nextChar === '\\' || nextChar === '"' || nextChar === '/') {
      result += char;
      escaped = true;
      continue;
    }

    if (nextChar === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
      result += char;
      escaped = true;
      continue;
    }

    const commandMatch = text.slice(i + 1).match(/^[A-Za-z]+/);
    if ((commandMatch?.[0].length ?? 0) >= 2) {
      // LLM이 "\sqrt", "\left", "\frac" 같은 LaTeX를 단일 백슬래시로 내보내는 경우를 보정한다.
      result += '\\\\';
      continue;
    }

    if ('bfnrt'.includes(nextChar)) {
      result += char;
      escaped = true;
      continue;
    }

    result += '\\\\';
  }

  return result;
}

function tryParseJson<T>(candidate: string): T | null {
  const repaired = repairJsonLikeString(candidate);

  try {
    return JSON.parse(repaired) as T;
  } catch {
    try {
      return JSON.parse(escapeLikelyLatexBackslashes(repaired)) as T;
    } catch {
      return null;
    }
  }
}

function extractSingleLineObjectFragment(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidateLine = lines.find((line) =>
    /^"?\s*[A-Za-z_][A-Za-z0-9_]*\s*"?\s*:/.test(line)
  );

  if (!candidateLine) {
    return null;
  }

  const normalizedLine = candidateLine.replace(
    /^"?\s*([A-Za-z_][A-Za-z0-9_]*)\s*"?\s*:/,
    (_, key: string) => `"${key}":`
  );

  return `{${normalizedLine.replace(/,$/, '')}}`;
}

export function parseJsonObjectFromText<T>(text: string): T | null {
  const normalizedText = text
    .replace(/^\s*Assistant\b[:\s-]*/i, '')
    .trim();
  const explicitJsonCodeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const genericCodeBlockMatch = text.match(/```[\w-]*\s*([\s\S]*?)\s*```/i);
  const candidates = [
    explicitJsonCodeBlockMatch?.[1],
    extractBalancedJsonObject(normalizedText),
    extractSingleLineObjectFragment(normalizedText),
    extractBalancedJsonObject(genericCodeBlockMatch?.[1] ?? ''),
    extractSingleLineObjectFragment(genericCodeBlockMatch?.[1] ?? ''),
    genericCodeBlockMatch?.[1],
    normalizedText,
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()));

  for (const candidate of candidates) {
    const parsed = tryParseJson<T>(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function extractConceptCodeCandidates(text: string): string[] {
  const matches = Array.from(
    text.matchAll(/\b(?:CU-)?[A-Z]{2,}(?:-[A-Z0-9_]+)+\b/g)
  ).map((match) => match[0].trim());

  return Array.from(new Set(matches));
}

function parseRequiredConceptAnalysisFromText(text: string): {
  requiredConcepts: string[];
  baseDifficulty: number | null;
} {
  const parsedObject = parseJsonObjectFromText<{ required_concepts?: string[]; base_difficulty?: number }>(text);
  if (parsedObject && Array.isArray(parsedObject.required_concepts)) {
    return {
      requiredConcepts: parsedObject.required_concepts
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
      baseDifficulty:
        typeof parsedObject.base_difficulty === 'number' &&
        Number.isInteger(parsedObject.base_difficulty) &&
        parsedObject.base_difficulty >= 1 &&
        parsedObject.base_difficulty <= 5
          ? parsedObject.base_difficulty
          : null,
    };
  }

  const arrayCandidates = [
    extractBalancedJsonArray(text),
    extractBalancedJsonArray(text.replace(/^\s*Assistant\b[:\s-]*/i, '').trim()),
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()));

  for (const candidate of arrayCandidates) {
    const parsedArray = tryParseJson<unknown[]>(candidate);
    if (!Array.isArray(parsedArray)) {
      continue;
    }

    const requiredConcepts = parsedArray
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);

    if (requiredConcepts.length > 0) {
      return {
        requiredConcepts,
        baseDifficulty: null,
      };
    }
  }

  return {
    requiredConcepts: extractConceptCodeCandidates(text),
    baseDifficulty: null,
  };
}

function parseBracketKeyValueText(text: string): Record<string, string> | null {
  const normalized = text
    .replace(/```[\s\S]*?```/g, '')
    .trim();

  const matches = Array.from(
    normalized.matchAll(/^\[\s*([A-Za-z_][A-Za-z0-9_]*)\s*\]\s*:\s*(.+)$/gm)
  );

  if (matches.length === 0) {
    return null;
  }

  const result: Record<string, string> = {};

  for (const match of matches) {
    const key = match[1].trim();
    let value = match[2].trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).trim();
    }

    result[key] = value;
  }

  return result;
}

function normalizeFailureType(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return VALID_FAILURE_TYPES.has(normalized) ? normalized : null;
}

function normalizeConceptCode(value: unknown, candidateConceptCodes: string[]): string {
  if (typeof value !== 'string') {
    return 'unmapped_bottleneck';
  }

  const normalized = value.trim();
  if (!normalized) {
    return 'unmapped_bottleneck';
  }

  if (normalized === 'unmapped_bottleneck') {
    return normalized;
  }

  return candidateConceptCodes.includes(normalized)
    ? normalized
    : 'unmapped_bottleneck';
}

async function getBottleneckGateResult({
  problemText,
  recentContext,
  latestStudentMessage,
}: {
  problemText: string;
  recentContext: string;
  latestStudentMessage: string;
}): Promise<{
  should_tag: boolean;
  focus_text: string;
  reason: string;
} | null> {
  const { buildBottleneckGateInput } = await import('./prompts');

  const gateText = await hfGenerateText({
    model: TAGGING_MODEL,
    inputs: buildBottleneckGateInput({
      problemText,
      recentContext,
      latestStudentMessage,
    }),
    parameters: { max_new_tokens: 1024, temperature: 0.1 },
    responseFormat: gateResponseFormat,
  });

  try {
    const parsed = parseJsonObjectFromText<{
      should_tag?: boolean;
      focus_text?: string;
      reason?: string;
    }>(gateText);

    if (!parsed || typeof parsed.should_tag !== 'boolean') {
      console.error('[ai-service] Gate JSON 파싱 실패: should_tag 누락');
      console.error('[ai-service] Gate 원문 미리보기:', previewForLog(gateText, 300));
      return null;
    }

    return {
      should_tag: parsed.should_tag,
      focus_text: typeof parsed.focus_text === 'string' ? parsed.focus_text.trim() : '',
      reason: typeof parsed.reason === 'string' ? parsed.reason.trim() : '',
    };
  } catch (e) {
    console.error('[ai-service] Gate JSON 파싱 실패:', e);
    console.error('[ai-service] Gate 원문 미리보기:', previewForLog(gateText, 300));
    return null;
  }
}

function parseDiagnosisResultFromText(
  text: string,
  candidateConceptCodes: string[],
  fallbackDescription: string
): {
  selected_concept_code: string;
  failure_type: string | null;
  student_friendly_description: string;
} | null {
  try {
    const parsed = parseJsonObjectFromText<{
      selected_concept_code?: string;
      failure_type?: string;
      student_friendly_description?: string;
    }>(text);

    if (!parsed) {
      return null;
    }

    return {
      selected_concept_code: normalizeConceptCode(parsed.selected_concept_code, candidateConceptCodes),
      failure_type: normalizeFailureType(parsed.failure_type),
      student_friendly_description:
        typeof parsed.student_friendly_description === 'string' && parsed.student_friendly_description.trim()
          ? parsed.student_friendly_description.trim()
          : fallbackDescription,
    };
  } catch {
    const bracketParsed = parseBracketKeyValueText(text);

    if (!bracketParsed) {
      return null;
    }

    return {
      selected_concept_code: normalizeConceptCode(bracketParsed.selected_concept_code, candidateConceptCodes),
      failure_type: normalizeFailureType(bracketParsed.failure_type),
      student_friendly_description:
        typeof bracketParsed.student_friendly_description === 'string' && bracketParsed.student_friendly_description.trim()
          ? bracketParsed.student_friendly_description.trim()
          : fallbackDescription,
    };
  }
}

async function getStrictDiagnosisResult({
  problemText,
  recentContext,
  candidatesText,
  candidateConceptCodes,
  fallbackDescription,
}: {
  problemText: string;
  recentContext: string;
  candidatesText: string;
  candidateConceptCodes: string[];
  fallbackDescription: string;
}): Promise<{
  selected_concept_code: string;
  failure_type: string;
  student_friendly_description: string;
} | null> {
  const {
    buildDiagnosisRepairInput,
    buildDiagnosisSelectionInput,
  } = await import('./prompts');

  const baseInput = buildDiagnosisSelectionInput({
    problemText,
    recentContext,
    candidatesText,
  });

  const firstAttemptText = await hfGenerateText({
    model: TAGGING_MODEL,
    inputs: baseInput,
    parameters: { max_new_tokens: 1024, temperature: 0.1 },
    responseFormat: diagnosisResponseFormat,
  });

  const firstParsed = parseDiagnosisResultFromText(
    firstAttemptText,
    candidateConceptCodes,
    fallbackDescription
  );

  if (firstParsed?.failure_type) {
    return {
      selected_concept_code: firstParsed.selected_concept_code,
      failure_type: firstParsed.failure_type,
      student_friendly_description: firstParsed.student_friendly_description,
    };
  }

  console.error('[ai-service] Step 3 JSON 파싱 실패 또는 failure_type 불일치');
  console.error('[ai-service] Step 3 원문 미리보기:', previewForLog(firstAttemptText, 300));

  const repairInput = buildDiagnosisRepairInput({
    problemText,
    recentContext,
    candidatesText,
    previousOutput: firstAttemptText,
  });

  const secondAttemptText = await hfGenerateText({
    model: TAGGING_MODEL,
    inputs: repairInput,
    parameters: { max_new_tokens: 256, temperature: 0.0 },
    responseFormat: diagnosisResponseFormat,
  });

  const secondParsed = parseDiagnosisResultFromText(
    secondAttemptText,
    candidateConceptCodes,
    fallbackDescription
  );

  if (!secondParsed?.failure_type) {
    console.error('[ai-service] Step 3 재시도 실패: 저장하지 않음');
    console.error('[ai-service] Step 3 재시도 원문 미리보기:', previewForLog(secondAttemptText, 300));
    return null;
  }

  return {
    selected_concept_code: secondParsed.selected_concept_code,
    failure_type: secondParsed.failure_type,
    student_friendly_description: secondParsed.student_friendly_description,
  };
}

export function sanitizeDialogueMessageText(text: string, role: string): string {
  const normalized = String(text ?? '');

  if (role === 'assistant' || role === 'ai_tutor') {
    return normalized
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<\/?think>/gi, '')
      .replace(/\[PROBLEM_SOLVED\]/g, '')
      .trim();
  }

  return normalized.trim();
}

/**
 * 텍스트 기반의 문제 해시 생성 (DB 조회용)
 */
export function generateProblemHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

/**
 * [Core] HuggingFace 통합 API 호출 엔진
 */
async function hfFetch(url: string, body: any, options?: { timeoutMs?: number }) {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs;
  const timeoutId = timeoutMs
    ? setTimeout(() => controller.abort(`timeout:${timeoutMs}`), timeoutMs)
    : null;

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      throw new Error(`요청 시간 초과 (${timeoutMs}ms)`);
    }

    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HF API Error: ${response.status} - ${errorText}`);
  }

  return response;
}

/**
 * [Core] 단일 텍스트 생성 전용 헬퍼
 */
export async function hfGenerateText({
  model,
  inputs,
  parameters = { max_new_tokens: DEFAULT_CHAT_MAX_TOKENS, temperature: 0.3 },
  isVision = false,
  system,
  timeoutMs,
  responseFormat,
}: {
  model: string;
  inputs: string | Json | Record<string, unknown>;
  parameters?: {
    max_new_tokens?: number;
    temperature?: number;
  };
  isVision?: boolean;
  system?: string;
  timeoutMs?: number;
  responseFormat?: StructuredResponseFormat;
}): Promise<string> {
  const url = `https://router.huggingface.co/v1/chat/completions`;
  const shouldLogStructuredAttempts = isTaggingStructuredRequest(model, responseFormat);
  const visionInputs = isVision ? (inputs as { text?: string; image: string }) : null;
  const messages = isVision
    ? [
      {
        role: 'user',
        content: [
          { type: 'text', text: visionInputs?.text || '이미지 안의 정보를 추출하세요.' },
          { type: 'image_url', image_url: { url: visionInputs?.image } },
        ],
      },
    ]
    : [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: typeof inputs === 'string' ? inputs : JSON.stringify(inputs) }
    ];

  try {
    const extraBody = getChatCompletionExtraBody(model);
    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: parameters.temperature ?? 0.3,
      ...(extraBody ?? {}),
    };

    if (!responseFormat || responseFormat.type === 'text') {
      requestBody.max_tokens = parameters.max_new_tokens || DEFAULT_CHAT_MAX_TOKENS;
    } else {
      requestBody.response_format = responseFormat;
    }

    const response = await hfFetch(url, requestBody, { timeoutMs });
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim() || '';

    if (shouldLogStructuredAttempts) {
      console.log('[hfGenerateText] structured success', {
        model,
        responseFormatType: responseFormat?.type ?? 'text',
        extraBody: extraBody ?? {},
        contentPreview: previewForLog(content, 120),
      });
    }

    return content;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (shouldLogStructuredAttempts) {
      console.warn('[hfGenerateText] structured attempt failed', {
        model,
        responseFormatType: responseFormat?.type ?? 'text',
        extraBody: getChatCompletionExtraBody(model) ?? {},
        error: errorMessage,
      });
    }

    throw new Error(`[hfGenerateText] 호출 실패 (${model}): ${errorMessage}`);
  }
}

/**
 * [공통] HuggingFace Inference API 스트리밍 헬퍼
 */
export async function hfStreamText({
  model,
  messages,
  system,
  onFinish,
  maxTokens = DEFAULT_CHAT_MAX_TOKENS,
  debugTag,
}: {
  model: string;
  messages: any[];
  system?: string;
  onFinish?: (text: string) => void;
  maxTokens?: number;
  debugTag?: string;
}): Promise<ReadableStream> {
  const url = `https://router.huggingface.co/v1/chat/completions`;

  const formattedMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  try {
    const response = await hfFetch(url, {
      model,
      messages: formattedMessages,
      max_tokens: maxTokens,
      temperature: 0.7,
      stream: true,
      ...getChatCompletionExtraBody(model),
    });

    if (HF_STREAM_DEBUG) {
      console.log('[hfStreamText][init]', {
        debugTag,
        model,
        messageCount: formattedMessages.length,
        maxTokens,
        extraBody: getChatCompletionExtraBody(model),
        contentType: response.headers.get('content-type'),
      });
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    return new ReadableStream({
      async start(controller) {
        if (!reader) return;
        let fullText = '';
        let chunkIndex = 0;
        let parsedEventCount = 0;
        let contentEventCount = 0;
        let reasoningEventCount = 0;
        try {
          let partialChunk = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunkIndex += 1;

            const chunk = partialChunk + decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            partialChunk = lines.pop() || '';

            if (HF_STREAM_DEBUG) {
              console.log('[hfStreamText][chunk]', {
                debugTag,
                chunkIndex,
                byteLength: value.byteLength,
                lineCount: lines.length,
                partialTailLength: partialChunk.length,
              });
            }

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

              if (trimmedLine.startsWith('data: ')) {
                try {
                  const data = JSON.parse(trimmedLine.slice(6));
                  parsedEventCount += 1;
                  const delta = data.choices?.[0]?.delta || {};
                  const reasoningText =
                    delta.reasoning !== undefined && delta.reasoning !== null
                      ? String(delta.reasoning)
                      : '';

                  const contentToAdd =
                    delta.content !== undefined && delta.content !== null
                      ? String(delta.content)
                      : '';

                  if (reasoningText) {
                    reasoningEventCount += 1;
                  }

                  if (contentToAdd) {
                    contentEventCount += 1;
                  }

                  if (HF_STREAM_DEBUG) {
                    console.log('[hfStreamText][event]', {
                      debugTag,
                      parsedEventCount,
                      hasContent: Boolean(contentToAdd),
                      contentLength: contentToAdd.length,
                      contentPreview: previewForLog(contentToAdd),
                      hasReasoning: Boolean(reasoningText),
                      reasoningLength: reasoningText.length,
                      reasoningPreview: previewForLog(reasoningText),
                      finishReason: data.choices?.[0]?.finish_reason ?? null,
                    });
                  }

                  if (contentToAdd) {
                    fullText += contentToAdd;
                    controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(contentToAdd)}\n`));
                  }
                } catch (e) {
                  if (HF_STREAM_DEBUG) {
                    console.warn('[hfStreamText][parse-error]', {
                      debugTag,
                      linePreview: previewForLog(trimmedLine),
                      error: e instanceof Error ? e.message : String(e),
                    });
                  }
                  // 파싱 실패시 무시
                }
              }
            }
          }
        } catch (err) {
          console.error(`[hfStreamText] 스트림 중단 에러 (${model}):`, err);
          controller.error(err);
        } finally {
          if (HF_STREAM_DEBUG) {
            console.log('[hfStreamText][done]', {
              debugTag,
              model,
              chunkIndex,
              parsedEventCount,
              contentEventCount,
              reasoningEventCount,
              finalTextLength: fullText.length,
              finalPreview: previewForLog(fullText, 200),
            });
          }
          onFinish?.(fullText.trim());
          controller.close();
        }
      },
    });
  } catch (err) {
    throw new Error(`[hfStreamText] 초기화 실패 (${model}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

function isPdfUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.pdf');
  } catch {
    return url.toLowerCase().split('?')[0].endsWith('.pdf');
  }
}

function sanitizeOcrOutput(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, ''))
    .replace(/^\s*(다음은 OCR 결과입니다\.?|OCR 결과:)\s*/i, '')
    .trim();
}

/**
 * [Route 1] VISION_MODEL을 사용하여 이미지에서 LaTeX 및 텍스트 추출
 */
export async function performOCR(imageUrls: string[]): Promise<string> {
  if (imageUrls.length === 0) return '';

  try {
    const { buildKoreanMathOcrPrompt } = await import('./prompts');
    console.log(`[ai-service] OCR 시도 중 (${VISION_MODEL})...`);

    const text = await hfGenerateText({
      model: VISION_MODEL,
      inputs: {
        image: imageUrls[0],
        text: buildKoreanMathOcrPrompt(),
      },
      parameters: { max_new_tokens: 2048 },
      isVision: true,
      timeoutMs: 45000,
    });

    const sanitizedText = sanitizeOcrOutput(text);

    console.log('[ai-service] OCR 완료:', {
      model: VISION_MODEL,
      outputChars: sanitizedText.length,
      preview: previewForLog(sanitizedText, 200),
    });

    return sanitizedText;
  } catch (error) {
    throw new Error(`OCR 분석 실패 (${VISION_MODEL}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

export { isPdfUrl };

export function normalizeProblemText(text: string): string {
  return text.trim();
}

/**
 * [Route 1] DB에서 해당 문제의 전략 그래프가 있는지 확인
 */
export async function getStrategyGraph(problemHash: string): Promise<{
  problem_hash: string;
  problem_text: string | null;
  required_concepts: string[];
  base_difficulty: number;
  intended_path: string[];
  graph_data: any;
  is_human_verified: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
} | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('strategy_graphs')
    .select('*')
    .eq('problem_hash', problemHash)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error) {
    console.error('[ai-service] getStrategyGraph 에러:', error);
    return null;
  }

  return data as any;
}

export async function ensureStrategyGraphExists(problemHash: string, problemText: string) {
  const supabase = getSupabaseAdmin();
  const canonicalProblemText = problemText.trim();

  const { data: existing, error: existingError } = await supabase
    .from('strategy_graphs')
    .select('problem_hash, problem_text, is_deleted')
    .eq('problem_hash', problemHash)
    .maybeSingle();

  if (existingError) {
    console.error('[ai-service] ensureStrategyGraphExists 조회 에러:', existingError);
    throw existingError;
  }

  if (existing) {
    if (existing.is_deleted) {
      const { error: reviveError } = await supabase
        .from('strategy_graphs')
        .update({
          problem_text: canonicalProblemText || null,
          required_concepts: [],
          base_difficulty: 3,
          intended_path: [],
          graph_data: {},
          is_human_verified: false,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
        })
        .eq('problem_hash', problemHash);

      if (reviveError) {
        console.error('[ai-service] ensureStrategyGraphExists soft delete 복구 에러:', reviveError);
        throw reviveError;
      }

      return;
    }

    if (!existing.problem_text?.trim() && canonicalProblemText) {
      const { error: updateError } = await supabase
        .from('strategy_graphs')
        .update({ problem_text: canonicalProblemText })
        .eq('problem_hash', problemHash);

      if (updateError) {
        console.error('[ai-service] ensureStrategyGraphExists problem_text 업데이트 에러:', updateError);
        throw updateError;
      }
    }
    return;
  }

  const { error: insertError } = await supabase
    .from('strategy_graphs')
    .insert({
      problem_hash: problemHash,
      problem_text: canonicalProblemText || null,
      required_concepts: [],
      base_difficulty: 3,
      intended_path: [],
      graph_data: {},
      is_human_verified: false,
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
    });

  if (insertError) {
    console.error('[ai-service] ensureStrategyGraphExists 삽입 에러:', insertError);
    throw insertError;
  }
}

/**
 * [Route 1] 새 튜터링 세션 생성 (1 Problem = 1 Session)
 */
export async function createTutoringSession({
  studentId,
  problemHash,
  extractedText,
}: {
  studentId: string;
  problemHash: string;
  extractedText: string;
}) {
  const supabase = getSupabaseAdmin();

  // 1. 기존 진행 중인 세션들(in_progress) 찾기
  const { data: activeSessions } = await supabase
    .from('tutoring_sessions')
    .select('id, problem_hash')
    .eq('student_id', studentId)
    .eq('session_status', 'in_progress');

  // 2. 기존 세션들을 abandoned 상태로 변경 (분석은 세션 리포트 조회 시 온디맨드로 처리)
  if (activeSessions && activeSessions.length > 0) {
    const activeIds = activeSessions.map(s => s.id);

    await supabase
      .from('tutoring_sessions')
      .update({
        session_status: 'abandoned',
        updated_at: new Date().toISOString()
      })
      .in('id', activeIds);

    console.log(`[ai-service] 이전 세션 ${activeIds.length}개 일시정지 완료. 분석은 리포트 조회 시 수행됩니다.`);
  }

  const { data, error } = await supabase
    .from('tutoring_sessions')
    .insert({
      student_id: studentId,
      problem_hash: problemHash,
      extracted_text: extractedText,
      session_status: 'in_progress' as const,
      has_student_consent: true, // 프로필 온보딩 완료 사용자만 세션 진입 가능
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ai-service] createTutoringSession 에러:', error);
    throw error;
  }

  return data.id;
}

/**
 * 세션 상태 전환 (in_progress ↔ abandoned ↔ completed 등)
 * "새 질문" 클릭 시 기존 세션을 abandoned로,
 * 과거 세션 재진입 시 다시 in_progress로 복원합니다.
 */
export async function updateSessionStatus(
  sessionId: string,
  status: 'in_progress' | 'completed' | 'abandoned' | 'viewed_answer'
) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('tutoring_sessions')
    .update({
      session_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.error('[ai-service] updateSessionStatus 에러:', error);
  }
}

/**
 * [Route 2] 대화 로그를 dialogue_logs 테이블에 저장 (통합 JSONB 형태)
 */
export async function updateDialogueLogs({
  sessionId,
  messages,
}: {
  sessionId: string;
  messages: Array<{ role: string; content: string }>;
}) {
  const supabase = getSupabaseAdmin();
  const sanitizedMessages = messages.map((message) => ({
    ...message,
    content: sanitizeDialogueMessageText(message.content, message.role),
  }));
  const { error } = await supabase.from('dialogue_logs').upsert(
    {
      session_id: sessionId,
      messages: sanitizedMessages,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'session_id' }
  );

  if (error) {
    console.error('[ai-service] updateDialogueLogs 에러:', error);
  }
}

export async function getTutoringSession(sessionId: string): Promise<{
  id: string;
  student_id: string;
  extracted_text: string;
  session_status: string;
  has_student_consent: boolean;
} | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tutoring_sessions')
    .select('id, student_id, extracted_text, session_status, has_student_consent')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('[ai-service] getTutoringSession 에러:', error);
    throw error;
  }

  return data as {
    id: string;
    student_id: string;
    extracted_text: string;
    session_status: string;
    has_student_consent: boolean;
  } | null;
}

export function getSlidingWindowMessages<T>(messages: T[]): T[] {
  return messages.slice(-CHAT_CONTEXT_WINDOW_SIZE);
}

/**
 * HuggingFace Inference API를 사용하여 텍스트 임베딩 생성 (1024차원)
 * multilingual-e5-large-instruct 모델은 입력 데이터의 성격에 따라 프리픽스를 붙입니다.
 * type이 'passage'인 경우 "passage: "를, 'query'인 경우 "query: "를 붙여 매칭 성능을 최적화합니다.
 */
export async function generateEmbedding(text: string, type: 'query' | 'passage' = 'passage'): Promise<number[]> {
  const prefix = type === 'query' ? 'query: ' : 'passage: ';

  try {
    // 사용자 제공 공식 문서 규격: Router + hf-inference + feature-extraction 파이프라인
    const modelId = EMBEDDING_MODEL.split(':')[0];
    const url = `https://router.huggingface.co/hf-inference/models/${modelId}/pipeline/feature-extraction`;

    console.log(`[ai-service] 공식 규격 임베딩 요청 시작: ${modelId}`);

    const response = await hfFetch(url, {
      inputs: prefix + text.trim()
    });

    const result = await response.json();

    // HF Pipeline Response Handling (주로 [[...]] 또는 [...] 배열)
    if (Array.isArray(result)) {
      const vec = Array.isArray(result[0]) ? result[0] : result;
      console.log(`[ai-service] ✅ 공식 규격 임베딩 생성 성공 (Model: ${modelId}, Dim: ${vec.length})`);
      return vec;
    }

    // 예비용 OpenAI 방식 대응 ({ data: [{ embedding: [...] }] })
    if (result.data && Array.isArray(result.data) && result.data[0]?.embedding) {
      const vec = result.data[0].embedding;
      console.log(`[ai-service] ✅ Router 방식 벡터 생성 성공 (Dim: ${vec.length})`);
      return vec;
    }

    console.error(`[ai-service] ❌ 예상치 못한 응답 구조:`, result);
    throw new Error(`임베딩 생성 실패: ${JSON.stringify(result).slice(0, 100)}`);
  } catch (err) {
    console.error(`[ai-service] ❌ 임베딩 최종 에러:`, err);
    throw new Error(`임베딩 생성 실패 (${EMBEDDING_MODEL}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * [Route 2] 백그라운드 병목 감지 및 RAG 매칭 (Two-Step RAG)
 * next/after() 내에서 실행
 */
export async function runBottleneckDetection({
  sessionId,
  problemText,
  messages,
}: {
  sessionId: string;
  problemText: string;
  messages: Array<{ role: string; content: string }>;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: session } = await supabase
      .from('tutoring_sessions')
      .select('session_status')
      .eq('id', sessionId)
      .maybeSingle();

    if (!session || session.session_status !== 'in_progress') {
      return;
    }

    const recentContext = messages.slice(-3).map(m => `${m.role === 'assistant' ? 'AI' : '학생'}: ${m.content}`).join('\n');
    const latestStudentMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

    if (!latestStudentMessage || latestStudentMessage.trim() === '') return;

    // Step 1: Gate LLM이 이 턴을 병목 진단 대상으로 보낼지 결정
    const gateResult = await getBottleneckGateResult({
      problemText,
      recentContext,
      latestStudentMessage,
    });

    if (!gateResult || !gateResult.should_tag) {
      return;
    }

    const retrievalText = gateResult.focus_text.trim();
    if (!retrievalText) {
      console.error('[ai-service] Gate 결과는 should_tag=true지만 focus_text가 비어 있음');
      return;
    }

    // Step 2: 임베딩 및 혼합 RAG 검색 (Union Search) - 검색용 'query' 프리픽스 사용
    const embedding = await generateEmbedding(retrievalText, 'query');
    const { data: candidates, error: rpcError } = await supabase.rpc(
      'match_concept_nodes',
      { query_embedding: JSON.stringify(embedding), match_count: 5 }
    );

    if (rpcError || !candidates || candidates.length === 0) {
      console.error('[ai-service] RAG 매칭 실패:', rpcError);
      return;
    }

    const candidatesText = candidates.map((c: any) => `[${c.concept_code}] ${c.matched_text}`).join('\n');

    const candidateConceptCodes = candidates
      .map((c: any) => (typeof c.concept_code === 'string' ? c.concept_code.trim() : ''))
      .filter(Boolean);

    // Step 3: LLM 최종 진단 (Concept & Failure Type Selection)
    const diagnosisResult = await getStrictDiagnosisResult({
      problemText,
      recentContext,
      candidatesText,
      candidateConceptCodes,
      fallbackDescription: retrievalText,
    });

    if (!diagnosisResult) {
      return;
    }

    // Step 4: DB 저장
    const { error: insertError } = await supabase
      .from('learning_bottlenecks')
      .insert({
        session_id: sessionId,
        mapped_concept_id: diagnosisResult.selected_concept_code,
        failure_type: diagnosisResult.failure_type,
        candidate_matches: candidates,
        struggle_description: diagnosisResult.student_friendly_description,
        searchable_vector: embedding,
        is_resolved_by_student: false,
      });

    if (insertError) {
      console.error('[ai-service] 병목 저장 에러:', insertError);
    } else {
      console.log(`[ai-service] 병목 진단 저장 완료: ${diagnosisResult.selected_concept_code}`);
    }
  } catch (err) {
    console.error('[ai-service] runBottleneckDetection 에러:', err);
  }
}

/**
 * [세션 종료] required_concepts 지연 수집 (Lazy Loading - Phase 2)
 * 
 * 세션이 종료(completed/abandoned)될 때 호출하여
 * strategy_graphs의 required_concepts만 분석하여 보관합니다.
 * 
 * ⚠️ intended_path, graph_data는 추후 확장을 위해 예약되어 있으며 현재는 사용하지 않습니다.
 */
export async function extractAndUpdateRequiredConcepts({
  sessionId,
  problemHash,
}: {
  sessionId: string;
  problemHash: string;
}): Promise<{ requiredConcepts: string[]; baseDifficulty: number | null } | null> {
  try {
    const supabase = getSupabaseAdmin();

    // 1. 세션의 extracted_text(문제 원문) 가져오기
    const { data: session } = await supabase
      .from('tutoring_sessions')
      .select('extracted_text')
      .eq('id', sessionId)
      .single();

    if (!session?.extracted_text) {
      console.warn('[ai-service] extractAndUpdate: extracted_text 없음, 스킵:', sessionId);
      return null;
    }

    // 2. 해당 세션의 전체 대화 로그 가져오기
    const { data: logRow } = await supabase
      .from('dialogue_logs')
      .select('messages')
      .eq('session_id', sessionId)
      .maybeSingle();

    const messagesArray = logRow?.messages as any[] || [];

    // 3. 프롬프트 컨텍스트 조립
    const dialogueTranscript = messagesArray
      .map((l) => {
        const speaker = l.role === 'student' || l.role === 'user' ? '학생' : 'AI';
        const content = sanitizeDialogueMessageText(l.content, l.role);
        return `${speaker}: ${content}`;
      })
      .join('\n');

    const contextForLLM = dialogueTranscript.trim()
      ? `[문제 원문]\n${session.extracted_text}\n\n[전체 대화 기록]\n${dialogueTranscript}`
      : `[문제 원문]\n${session.extracted_text}\n\n[전체 대화 기록]\n(대화 기록 없음)`;

    // 4. Tagging LLM 호출: required_concepts만 추출
    const { buildConceptExtractionInput } = await import('./prompts');
    const text = await hfGenerateText({
      model: TAGGING_MODEL,
      inputs: buildConceptExtractionInput(contextForLLM),
      parameters: { max_new_tokens: 2048, temperature: 0.1 },
      responseFormat: requiredConceptsResponseFormat,
    });

    // 5. JSON 파싱 (마크다운 코드블록 및 앞뒤 텍스트에 강인하게 처리)
    const analysisResult = parseRequiredConceptAnalysisFromText(text);
    const requiredConcepts = analysisResult.requiredConcepts;

    if (requiredConcepts.length === 0) {
      console.error('[ai-service] 개념 추출 JSON 파싱 에러: 유효한 required_concepts를 찾지 못함');
      console.error('[ai-service] 개념 추출 원문 미리보기:', previewForLog(text, 300));
      console.warn('[ai-service] 추출된 개념이 0개, 스킵:', sessionId);
      return null;
    }

    // 6. strategy_graphs UPDATE (required_concepts만, intended_path/graph_data는 건드리지 않음)
    const { error: updateError } = await supabase
      .from('strategy_graphs')
      .update({
        required_concepts: requiredConcepts,
        ...(analysisResult.baseDifficulty ? { base_difficulty: analysisResult.baseDifficulty } : {}),
      })
      .eq('problem_hash', problemHash);

    if (updateError) {
      console.error('[ai-service] strategy_graphs UPDATE 에러:', updateError);
    } else {
      console.log(
        `[ai-service] required_concepts 업데이트 완료 (${requiredConcepts.length}개):`,
        problemHash
      );
    }
    return {
      requiredConcepts,
      baseDifficulty: analysisResult.baseDifficulty,
    };
  } catch (err) {
    console.error('[ai-service] extractAndUpdateRequiredConcepts 실패:', err);
    return null;
  }
}
