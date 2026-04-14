import { generateText } from 'ai';
import { huggingface } from '@ai-sdk/huggingface';

async function main() {
  console.log("Testing Qwen/Qwen3.5-27B...");
  try {
    const res = await generateText({
      model: huggingface('Qwen/Qwen3.5-27B'),
      prompt: 'Reply with JSON: {"answer": 2}',
    });
    console.log("SUCCESS:", res.text);
  } catch (err: any) {
    console.error("ERROR:", err.message);
  }
}

main();
