import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
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
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

let aiInstance: GoogleGenAI | null = null;

export function getAi(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

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
): Promise<{ result: T; attempts: number }> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return { result: await fn(), attempts: attempt };
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
        filePath: "src/lib/gemini.ts",
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
 * Ham metin yanıtından markdown kod bloklarını temizler ve JSON olarak parse eder.
 *
 * @param text - Gemini'den gelen ham metin yanıtı
 * @returns Parse edilmiş JSON nesnesi
 */
export function sanitizeAndParseJson<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```$/, "")
      .trim();
  }
  return JSON.parse(cleaned) as T;
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
    payloadStage?: string;
    zodSchema?: z.ZodType<T>;
  },
): Promise<T> {
  const startTime = performance.now();
  let attempts: number | undefined;

  const thinkingLevel = options?.thinkingConfig?.thinkingLevel;

  logger?.info("ai_request_start", {
    service: "gemini",
    data: {
      model: modelName,
      instructionLength: systemInstruction.length,
      promptLength: prompt.length,
      thinkingLevel: thinkingLevel ?? undefined,
    },
  });

  try {
    const { result: response, attempts: retryAttempts } = await retryOn503(
      () =>
        getAi().models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            systemInstruction,
            temperature: 1.0,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
            thinkingConfig: options?.thinkingConfig ?? undefined,
          },
        }),
      2,
      1000,
      logger,
    );

    const text = response.text;
    if (!text) {
      throw new Error("Gemini yanıtı boş döndü.");
    }

    const parsed = sanitizeAndParseJson<T>(text);

    // 3. Runtime Zod schema validation (if provided)
    const zodSchema = options?.zodSchema;
    if (zodSchema) {
      const validationResult = zodSchema.safeParse(parsed);
      if (!validationResult.success) {
        logger?.error("ai_schema_validation_failed", {
          service: "gemini",
          filePath: "src/lib/gemini.ts",
          data: {
            model: modelName,
            errorCount: validationResult.error.issues.length,
            issues: validationResult.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          error: new Error(
            `Zod validation failed: ${validationResult.error.message}`,
          ),
        });
        throw new Error(
          "AI yanıtı beklenen yapısal şablona uymadı. Lütfen tekrar deneyin.",
        );
      }
    }

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

    attempts = retryAttempts;

    // Save debug payload
    const payloadStage = options?.payloadStage ?? "gemini";
    logger?.saveDebugPayload(payloadStage, modelName, prompt, text);

    logger?.info("ai_request_success", {
      service: "gemini",
      durationMs,
      tokens,
      data: {
        model: modelName,
        attempt: attempts,
        thinkingLevel: thinkingLevel ?? undefined,
      },
    });
    return parsed;
  } catch (error) {
    const durationMs = performance.now() - startTime;

    // Save debug payload even on failure
    const payloadStage = options?.payloadStage ?? "gemini";
    logger?.saveDebugPayload(payloadStage, modelName, prompt);

    logger?.error("ai_request_failed", {
      service: "gemini",
      filePath: "src/lib/gemini.ts",
      durationMs,
      data: {
        model: modelName,
        attempts,
        thinkingLevel: thinkingLevel ?? undefined,
      },
      error,
    });
    throw error;
  }
}
