import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function test() {
  const model = 'Qwen/Qwen3-Embedding-0.6B';
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  
  console.log('Using Key:', apiKey?.substring(0, 5) + '...');
  
  const response = await fetch(
    `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: "test text" }),
    }
  );

  if (!response.ok) {
    console.error('HF Error:', response.status, response.statusText);
    const err = await response.text();
    console.error(err);
    return;
  }

  const embedding = await response.json();
  const vector = Array.isArray(embedding[0]) ? embedding[0] : embedding;
  console.log('Embedding length:', vector.length);
}

test();
