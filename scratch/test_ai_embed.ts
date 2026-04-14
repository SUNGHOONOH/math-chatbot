import { config } from "dotenv";
import { resolve } from "path";
import { embed } from "ai";
import { huggingface } from "@ai-sdk/huggingface";

config({ path: resolve(process.cwd(), ".env.local") });

async function test() {
  try {
    const { embedding } = await embed({
      model: huggingface.embeddingModel("Qwen/Qwen3-Embedding-4B"),
      value: "test"
    });
    console.log("Success! len:", embedding.length);
  } catch (err: any) {
    console.error("embeddingModel err:", err.message);
    try {
      const { embedding } = await embed({
        model: huggingface.textEmbeddingModel("Qwen/Qwen3-Embedding-4B"),
        value: "test"
      });
      console.log("Success with textEmbeddingModel! len:", embedding.length);
    } catch (err2: any) {
      console.error("textEmbeddingModel err:", err2.message);
    }
  }
}
test();
