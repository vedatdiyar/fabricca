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
  minItems?: number;
  maxItems?: number;
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
 * Bir asenkron fonksiyonu 503 (UNAVAILABLE) veya sunucu yoğunluğu hatalarına karşı
 * üssel olarak geri çekilerek (exponential backoff) ve jitter ekleyerek yeniden dener.
 * Ayrıca 429 (RESOURCE_EXHAUSTED) kota aşımı hatalarını da daha uzun bekleme süreleriyle
 * otomatik olarak yeniden dener.
 *
 * @param fn - Çalıştırılacak ve hata durumunda yeniden denenecek asenkron işlem
 * @param maxRetries - Maksimum deneme sayısı (varsayılan: 3)
 * @param baseDelayMs - Başlangıç gecikme süresi milisaniye (varsayılan: 1000ms)
 * @param logger - Loglama için Logger instance'ı
 */
async function retryOn503<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
  logger?: Logger,
): Promise<T> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (error: unknown) {
      const isRetryable =
        error instanceof Error &&
        (("status" in error &&
          ((error as { status: string }).status === "UNAVAILABLE" ||
            (error as { status: string }).status === "RESOURCE_EXHAUSTED")) ||
          ("code" in error &&
            ((error as { code: number }).code === 503 ||
              (error as { code: number }).code === 429)) ||
          error.message.includes("high demand") ||
          error.message.includes("503") ||
          error.message.includes("UNAVAILABLE") ||
          error.message.includes("429") ||
          error.message.includes("quota"));

      if (!isRetryable || attempt > maxRetries) {
        throw error;
      }

      const is429 =
        error.message.includes("429") ||
        error.message.includes("quota") ||
        error.message.includes("RESOURCE_EXHAUSTED");

      const exponent = attempt - 1;
      const backoffDelay = is429
        ? 30000 + attempt * 15000
        : baseDelayMs * Math.pow(2, exponent);
      const jitter = Math.random() * backoffDelay * 0.3; // %30 max jitter
      const totalDelay = backoffDelay + jitter;

      logger?.warn("ai_retry_attempt", {
        service: "gemini",
        step: `retry_attempt_${attempt}`,
        durationMs: totalDelay,
        data: {
          attempt,
          maxRetries,
          delayMs: Math.round(totalDelay),
          errorMessage: error?.message || String(error),
          quotaExceeded: is429,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }
}

/**
 * Gemini modelinden yapılandırılmış JSON çıktısı almak için generic yardımcı.
 * Yanıt, verilen JSON şemasına göre JSON olarak parse edilir.
 *
 * @param modelName - Kullanılacak Gemini model adı (örn. "gemini-3.1-flash-lite")
 * @param systemInstruction - Sistem talimatı (persona + kurallar)
 * @param prompt - Kullanıcı promptu
 * @param schema - Yanıtın doğrulanacağı JSON şeması
 * @param logger - Opsiyonel Logger instance'ı (AI event logları için)
 * @param options - Opsiyonel Gemini konfigürasyon seçenekleri
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

  try {
    const response = await retryOn503(
      () =>
        ai.models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            systemInstruction,
            temperature: 1.0,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
            thinkingConfig:
              options?.thinkingConfig === null
                ? undefined
                : options?.thinkingConfig || {
                    thinkingLevel: ThinkingLevel.HIGH,
                  },
          },
        }),
      3,
      1000,
      logger,
    );

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
      data: { model: modelName, attempt: 1 },
    });
    return parsed;
  } catch (error) {
    const durationMs = performance.now() - startTime;
    logger?.error("ai_request_failed", {
      service: "gemini",
      durationMs,
      data: { model: modelName, attempts: 1 },
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
