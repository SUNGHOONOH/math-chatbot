const { huggingface } = require("@ai-sdk/huggingface");
const { embed } = require("ai");

async function check() {
  try {
    const model = huggingface.textEmbeddingModel("Qwen/Qwen3-Embedding-4B");
    console.log("textEmbeddingModel created successfully");
  } catch (e) {
    console.log("textEmbeddingModel error", e.message);
  }
  try {
    const model2 = huggingface.embeddingModel("Qwen/Qwen3-Embedding-4B");
    console.log("embeddingModel created successfully");
  } catch (e) {
    console.log("embeddingModel error", e.message);
  }
}
check();
