import { GoogleGenAI } from "@google/genai";

/**
 * Service to generate vector embeddings using Google Gemini API.
 */

/**
 * Generates a 1536-dimensional embedding vector for the provided text content
 * using the gemini-embedding-2 model.
 */
export async function generateEmbedding(content: string): Promise<number[]> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error(
      "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
    );
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const response = await ai.models.embedContent({
    model: "gemini-embedding-2",
    contents: content,
    config: {
      outputDimensionality: 1536,
    },
  });

  const embeddingVector = response.embeddings?.[0]?.values;
  if (!embeddingVector || embeddingVector.length !== 1536) {
    throw new Error("Geçerli 1536 boyutlu embedding vektörü üretilemedi.");
  }

  return embeddingVector;
}
