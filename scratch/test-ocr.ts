import { config } from "dotenv";
import { resolve } from "path";
import { huggingface } from "@ai-sdk/huggingface";
import { generateText } from "ai";

config({ path: resolve(process.cwd(), ".env.local") });

async function check() {
  console.log("Testing OCR...");
  try {
    const { text } = await generateText({
      model: huggingface('Qwen/Qwen2.5-VL-7B-Instruct'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hello' }
          ],
        },
      ],
    });
    console.log("Success:", text);
  } catch(e) {
    console.log("Error:", e);
  }
}
check();
