import { GoogleGenAI } from "@google/genai";

/**
 * Service to generate vector embeddings using Google Gemini API.
 */

/**
 * Generates a 1536-dimensional embedding vector for the provided text content
 * using the gemini-embedding-2 model. Supports optional documentTitle for RAG context.
 */
export async function generateEmbedding(
  content: string,
  documentTitle?: string,
): Promise<number[]> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error(
      "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
    );
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  // Asymmetric RAG Biçimlendirmesi (Task Prefixes):
  const formattedContent = `title: ${documentTitle || "none"} | text: ${content}`;

  const response = await ai.models.embedContent({
    model: "gemini-embedding-2",
    contents: [{ parts: [{ text: formattedContent }] }],
    config: {
      // outputDimensionality 1536 olarak kalmalıdır çünkü veritabanı şeması vector(1536) boyutuna ayarlıdır.
      // Şemaya dokunulmaması gerektiği için 1536 dimension korundu.
      outputDimensionality: 1536,
    },
  });

  const embeddingVector = response.embeddings?.[0]?.values;
  if (!embeddingVector || embeddingVector.length !== 1536) {
    throw new Error("Geçerli 1536 boyutlu embedding vektörü üretilemedi.");
  }

  return embeddingVector;
}

/**
 * Generates 1536-dimensional embeddings for multiple text chunks in batches of 10.
 * Respects Gemini API rate limits with a 3-second delay between batches.
 */
export async function generateEmbeddingsBatch(
  chunks: string[],
  documentTitle?: string,
): Promise<number[][]> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error(
      "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
    );
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const results: number[][] = [];
  const batchSize = 10;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    console.log(
      `Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        chunks.length / batchSize,
      )}...`,
    );

    const response = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: [
        {
          parts: batch.map((chunk) => ({
            text: `title: ${documentTitle || "none"} | text: ${chunk}`,
          })),
        },
      ],
      config: {
        // outputDimensionality 1536 olarak kalmalıdır çünkü veritabanı şeması vector(1536) boyutuna ayarlıdır.
        // Şemaya dokunulmaması gerektiği için 1536 dimension korundu.
        outputDimensionality: 1536,
      },
    });

    if (!response.embeddings || response.embeddings.length === 0) {
      throw new Error("Vektörleştirme yanıtından boş sonuç döndü.");
    }

    for (const emb of response.embeddings) {
      if (emb.values) {
        results.push(emb.values);
      } else {
        throw new Error("Vektörleştirme değerleri eksik.");
      }
    }

    // Kota Koruyucu Gecikme (TPM Control):
    // Dakikalık rate limitlerine takılmamak için ardışık paket gönderimlerinin arasına 3 saniyelik bekleme ekliyoruz.
    if (i + batchSize < chunks.length) {
      console.log("Waiting 3 seconds to respect rate limits...");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  return results;
}
