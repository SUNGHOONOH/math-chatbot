import path from 'node:path';
import process from 'node:process';
import { config as loadEnv } from 'dotenv';

const cwd = process.cwd();
const envCandidates = ['.env.local', '.env'];
const loadedEnvFiles = [];

for (const relativePath of envCandidates) {
  const envPath = path.join(cwd, relativePath);
  const result = loadEnv({ path: envPath, override: false, quiet: true });
  if (!result.error) {
    loadedEnvFiles.push(relativePath);
  }
}

const apiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;

if (!apiKey) {
  console.error('[smoke-test] HUGGINGFACE_API_KEY 또는 HF_TOKEN 이 필요합니다.');
  console.error(`[smoke-test] env load attempted: ${loadedEnvFiles.join(', ') || 'none'}`);
  process.exit(1);
}

const MODEL_CANDIDATES = [
  'Qwen/Qwen3-8B:fireworks-ai',
  'Qwen/Qwen3-8B:featherless-ai',
];

function getExtraBodyVariants(model) {
  const isQwen3Family = model.startsWith('Qwen/Qwen3-') || model.startsWith('Qwen/Qwen3.5-');

  if (!isQwen3Family) {
    return [{}];
  }

  if (model.includes(':fireworks-ai')) {
    return [{ reasoning_effort: 'none' }, {}];
  }

  return [{ enable_thinking: false }, { reasoning_effort: 'none' }, {}];
}

function getExpectedSource(model) {
  return model.split(':')[1] || 'unknown';
}

function buildPayload(model, extraBody) {
  const expectedSource = getExpectedSource(model);

  return {
    model,
    messages: [
      {
        role: 'system',
        content: 'Return valid JSON only. Do not include markdown, code fences, or explanations.',
      },
      {
        role: 'user',
        content: `Return an object with ok=true, source="${expectedSource}", and mode="structured_output_test".`,
      },
    ],
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'structured_output_smoke_test',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok', 'source', 'mode'],
          properties: {
            ok: { type: 'boolean' },
            source: { type: 'string' },
            mode: { type: 'string' },
          },
        },
      },
    },
    ...extraBody,
  };
}

async function callModel(model, extraBody) {
  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildPayload(model, extraBody)),
    signal: AbortSignal.timeout(45_000),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 600)}`);
  }

  const parsedResponse = JSON.parse(text);
  const content = parsedResponse.choices?.[0]?.message?.content?.trim() || '';
  const parsedContent = JSON.parse(content);
  const expectedSource = getExpectedSource(model);

  if (
    parsedContent?.ok !== true ||
    parsedContent?.mode !== 'structured_output_test' ||
    parsedContent?.source !== expectedSource
  ) {
    throw new Error(`Schema validation failed: ${content}`);
  }

  return {
    content,
    parsedContent,
  };
}

async function main() {
  console.log('[smoke-test] loaded env files:', loadedEnvFiles.join(', ') || 'none');

  let passCount = 0;

  for (const model of MODEL_CANDIDATES) {
    let modelPassed = false;

    for (const extraBody of getExtraBodyVariants(model)) {
      try {
        const result = await callModel(model, extraBody);
        console.log(`PASS ${model} ${JSON.stringify(extraBody)}`);
        console.log(result.content);
        modelPassed = true;
        passCount += 1;
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`FAIL ${model} ${JSON.stringify(extraBody)} :: ${message}`);
      }
    }

    if (!modelPassed) {
      console.log(`RESULT ${model} :: all variants failed`);
    }
  }

  if (passCount === 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[smoke-test] unexpected failure:', error);
  process.exit(1);
});
