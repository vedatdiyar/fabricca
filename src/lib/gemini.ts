import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import type { Logger } from "./logger";
import { classifyError } from "./error-utils";
import crypto from "crypto";
import fs from "fs";
import path from "path";

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
  minimum?: number;
  maximum?: number;
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
 * Hatadan HTTP durum kodunu ve açıklamasını ayıklar.
 * Örn: "429 (RESOURCE_EXHAUSTED)" veya "503 (UNAVAILABLE)"
 */
function extractHttpStatus(error: unknown): string {
  if (error instanceof Error) {
    const err = error as unknown as Record<string, unknown>;
    const status = typeof err.status === "string" ? err.status : "";
    const code = typeof err.code === "number" ? err.code : 0;

    if (code === 429 || status === "RESOURCE_EXHAUSTED")
      return "429 (RESOURCE_EXHAUSTED)";
    if (code === 503 || status === "UNAVAILABLE") return "503 (UNAVAILABLE)";
    if (status) return `${code} (${status})`;
    if (code) return `${code}`;

    // Fallback: message içinden tara
    if (error.message.includes("429") || error.message.includes("quota"))
      return "429 (RESOURCE_EXHAUSTED)";
    if (error.message.includes("503") || error.message.includes("UNAVAILABLE"))
      return "503 (UNAVAILABLE)";
  }
  return "bilinmiyor";
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
export async function retryOn503<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
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
        const scenario = classifyError(error);
        const httpStatus = extractHttpStatus(error);
        logger?.error("ai_retry_exhausted", {
          service: "gemini",
          filePath: "src/lib/gemini.ts",
          step: "retry_exhausted",
          data: {
            attempt,
            maxRetries,
            scenario,
            httpStatus,
            retryLog: `GEMINI › RETRY | Deneme: ${attempt} | HTTP Durumu: ${httpStatus} | Mesaj: ${error instanceof Error ? error.message : String(error)}`,
          },
          error,
        });
        throw error;
      }

      const is429 =
        error.message.includes("429") ||
        error.message.includes("quota") ||
        error.message.includes("RESOURCE_EXHAUSTED") ||
        ("status" in error &&
          (error as { status: string }).status === "RESOURCE_EXHAUSTED") ||
        ("code" in error && (error as { code: number }).code === 429);

      const httpStatus = extractHttpStatus(error);
      const exponent = attempt - 1;
      const currentBaseDelay = is429 ? 5000 : baseDelayMs;
      const backoffDelay = currentBaseDelay * Math.pow(2, exponent);
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
          httpStatus,
          errorMessage: error?.message || String(error),
          quotaExceeded: is429,
          retryLog: `GEMINI › RETRY | Deneme: ${attempt} | HTTP Durumu: ${httpStatus} | Mesaj: ${error instanceof Error ? error.message : String(error)}`,
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
export function logRawLlmCall(params: {
  modelName: string;
  systemInstruction: string;
  userPrompt: string;
  payload: unknown;
  thesisMatrix: unknown;
  stage?: string;
}) {
  if (process.env.NODE_ENV !== "development") return;
  if (typeof window !== "undefined") return;

  const timestamp = new Date().toISOString();
  const combinedPrompt = `System Instruction:\n${params.systemInstruction}\n\nUser Prompt:\n${params.userPrompt}`;

  const hashObject = {
    systemInstruction: params.systemInstruction,
    userPrompt: params.userPrompt,
    combinedPrompt,
    payload: params.payload,
    thesisMatrix: params.thesisMatrix,
  };

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(hashObject))
    .digest("hex");

  const logData = {
    timestamp,
    hash,
    stage: params.stage || "gemini",
    ...hashObject,
  };

  try {
    const dir = path.resolve(process.cwd(), ".next/logs/llm_inputs");
    fs.mkdirSync(dir, { recursive: true });
    const cleanTime = timestamp.replace(/:/g, "-");
    const filename = `${cleanTime}_${hash.substring(0, 8)}.json`;
    fs.writeFileSync(
      path.join(dir, filename),
      JSON.stringify(logData, null, 2),
      "utf-8",
    );
  } catch (err) {
    console.error("Failed to write raw LLM log:", err);
  }

  return hash;
}

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
    seed?: number;
    temperature?: number;
    thesisMatrix?: unknown;
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

  const thesisMatrix = options?.thesisMatrix || null;

  const payload = {
    model: modelName,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
      temperature: options?.temperature ?? 1.0,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      thinkingConfig: options?.thinkingConfig ?? undefined,
      seed: options?.seed ?? undefined,
    },
  };

  logRawLlmCall({
    modelName,
    systemInstruction,
    userPrompt: prompt,
    payload,
    thesisMatrix,
    stage: options?.payloadStage,
  });

  try {
    const { result: response, attempts: retryAttempts } = await retryOn503(
      () => getAi().models.generateContent(payload),
      3,
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
    const scenario = classifyError(error);

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
        scenario,
      },
      error,
    });
    throw error;
  }
}
