import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

async function check() {
  console.log("Testing model...");
  const text = "test string";
  const EMBEDDING_MODEL = 'intfloat/multilingual-e5-large-instruct';
  const prefix = 'passage: ';
  
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${EMBEDDING_MODEL}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prefix + text }),
    }
  );

  console.log("Status:", response.status, response.statusText);
  if (!response.ok) {
    const errorText = await response.text();
    console.log("Error:", errorText);
  } else {
    const data = await response.json();
    console.log("Success! Array length:", Array.isArray(data[0]) ? data[0].length : data.length);
  }
}
check();
