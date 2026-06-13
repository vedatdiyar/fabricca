import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { Logger } from "./logger";

export interface JsonSchemaProperty {
  type: string;
  items?:
    | JsonSchemaProperty
    | {
        type: string;
        enum?: string[];
        properties?: Record<string, JsonSchemaProperty>;
        required?: string[];
      };
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  enum?: string[];
  description?: string;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not defined");
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Gemini modelinden yapılandırılmış JSON çıktısı almak için generic yardımcı.
 * Temperature her zaman 1.0 olarak sabitlenir, thinkingConfig high seviyede
 * çalışır ve yanıt, verilen JSON şemasına göre JSON olarak parse edilir.
 *
 * @param modelName - Kullanılacak Gemini model adı (örn. "gemini-3.1-flash-lite")
 * @param systemInstruction - Sistem talimatı (persona + kurallar)
 * @param prompt - Kullanıcı promptu
 * @param schema - Yanıtın doğrulanacağı JSON şeması
 * @param logger - Opsiyonel Logger instance'ı (AI event logları için)
 * @returns Şemaya uygun olarak parse edilmiş tip güvenli nesne
 */
export async function generateStructuredContent<T>(
  modelName: string,
  systemInstruction: string,
  prompt: string,
  schema: JsonSchema,
  logger?: Logger,
  options?: {
    thinkingConfig?: {
      thinkingLevel?: ThinkingLevel;
    } | null;
    temperature?: number;
  },
): Promise<T> {
  const startTime = performance.now();

  logger?.info("ai_request_start", {
    service: "gemini",
    data: {
      model: modelName,
      instructionLength: systemInstruction.length,
      promptLength: prompt.length,
    },
  });

  const maxAttempts = 5;
  const baseDelayMs = 3000;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          temperature:
            options?.temperature !== undefined ? options.temperature : 1.0,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          thinkingConfig:
            options?.thinkingConfig === null
              ? undefined
              : options?.thinkingConfig || {
                  thinkingLevel: ThinkingLevel.HIGH,
                },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemini yanıtı boş döndü.");
      }

      // ===== 🛡️ ROBUST SANITIZATION & TRUNCATION SAFEGUARD =====
      // 1. Clean markdown code blocks (```json ... ```) if present
      let cleanedText = text.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/, "")
          .replace(/```$/, "")
          .trim();
      }

      // 2. Attempt parsing the cleaned text
      const parsed = JSON.parse(cleanedText) as T;
      const durationMs = performance.now() - startTime;
      const metadata = (
        response as unknown as {
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        }
      )?.usageMetadata;

      const tokens = metadata
        ? {
            input: metadata.promptTokenCount,
            output: metadata.candidatesTokenCount,
            total: metadata.totalTokenCount,
          }
        : undefined;

      logger?.info("ai_request_success", {
        service: "gemini",
        durationMs,
        tokens,
        data: { model: modelName, attempt: attempt + 1 },
      });
      return parsed;
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxAttempts - 1;

      logger?.warn("ai_retry_attempt", {
        service: "gemini",
        step: `attempt_${attempt + 1}_failed`,
        data: { model: modelName, attempt: attempt + 1, isLastAttempt },
        error: error instanceof Error ? error.message : String(error),
      });

      if (!isLastAttempt) {
        // Exponential backoff + jitter (random between 500ms and 1500ms)
        const jitter = Math.random() * 1000 + 500;
        const delayMs = baseDelayMs * Math.pow(2, attempt) + jitter;
        logger?.info("ai_retry_attempt", {
          service: "gemini",
          step: "retry_delay",
          data: { delayMs, nextAttempt: attempt + 2 },
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const durationMs = performance.now() - startTime;
  logger?.error("ai_request_failed", {
    service: "gemini",
    durationMs,
    data: { model: modelName, attempts: maxAttempts },
    error: lastError,
  });

  throw new Error(
    `Gemini API çağrısı ${maxAttempts} denemeden sonra başarısız oldu: ${
      lastError instanceof Error ? lastError.message : "Bilinmeyen hata"
    }`,
  );
}

/**
 * Google Gemini Embedding v2 modelini kullanarak verilen metin dizisi için
 * toplu (batch) olarak vektör temsilleri (embeddings) üretir.
 *
 * @param texts - Vektörü çıkarılacak metinlerin listesi
 * @param logger - Opsiyonel Logger instance'ı
 * @returns Metinlerin embedding vektör değerleri dizisi
 */
export async function generateEmbeddings(
  texts: string[],
  logger?: Logger,
): Promise<number[][]> {
  const startTime = performance.now();
  logger?.info("ai_request_start", {
    service: "gemini",
    data: {
      model: "gemini-embedding-2",
      textsCount: texts.length,
    },
  });

  try {
    const chunkSize = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize);
      const response = await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: chunk.map((text) => ({ parts: [{ text }] })),
      });

      if (response.embeddings && Array.isArray(response.embeddings)) {
        for (const e of response.embeddings) {
          if (e.values) {
            allEmbeddings.push(e.values);
          } else {
            throw new Error("Embedding değerleri bulunamadı.");
          }
        }
      } else {
        throw new Error("Geçersiz embedding yanıtı.");
      }
    }

    const durationMs = performance.now() - startTime;
    logger?.info("ai_request_success", {
      service: "gemini",
      durationMs,
      data: { model: "gemini-embedding-2", textsCount: texts.length },
    });

    return allEmbeddings;
  } catch (error) {
    logger?.error("ai_request_failed", {
      service: "gemini",
      data: { model: "gemini-embedding-2", textsCount: texts.length },
      error,
    });
    throw error;
  }
}

/**
 * İki vektör arasındaki kosinüs benzerliğini (cosine similarity) hesaplar.
 *
 * @param vecA - Birinci vektör
 * @param vecB - İkinci vektör
 * @returns Kosinüs benzerlik skoru (-1 ile 1 arasında, 1 tam benzerliktir)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
