import {
  GoogleGenAI,
  ThinkingLevel,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/genai";
import { z } from "zod";
import { Logger, createFlowId } from "../logger";
import { classifyError } from "../error-utils";
import { withRetry } from "../api-utils";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export interface JsonSchemaProperty {
  type: string;
  items?:
    | JsonSchemaProperty
    | {
        type: string;
        enum?: (string | number)[];
        properties?: Record<string, JsonSchemaProperty>;
        required?: string[];
        additionalProperties?: boolean;
      };
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  enum?: (string | number)[];
  description?: string;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  additionalProperties?: boolean;
}

export interface JsonSchema {
  type: "object" | "array";
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: JsonSchemaProperty | JsonSchema;
  additionalProperties?: boolean;
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
  return "unknown";
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
 * @param modelName - Kullanılacak Gemini model adı (örn. GEMINI_MODEL sabiti)
 * @param systemInstruction - Sistem talimatı (persona + kurallar)
 * @param prompt - Kullanıcı promptu
 * @param schema - Yanıtın doğrulanacağı JSON şeması
 * @param logger - Opsiyonel Logger instance'ı (AI event logları için)
 * @param options - Opsiyonel Gemini konfigürasyon seçenekleri
 * @returns Şemaya uygun olarak parse edilmiş tip güvenli nesne
 */
export async function logRawLlmCall(params: {
  modelName: string;
  systemInstruction: string;
  userPrompt: string;
  payload: unknown;
  thesisMatrix: unknown;
  stage?: string;
}): Promise<string | undefined> {
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
    await fs.mkdir(dir, { recursive: true });
    const cleanTime = timestamp.replace(/:/g, "-");
    const filename = `${cleanTime}_${hash.substring(0, 8)}.json`;
    await fs.writeFile(
      path.join(dir, filename),
      JSON.stringify(logData, null, 2),
      "utf-8",
    );
  } catch (err) {
    const log = new Logger(createFlowId());
    log.error("failed_to_write_llm_log", {
      service: "gemini",
      data: { error: String(err) },
    });
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
    thesisMatrix?: unknown;
    safetySettings?: Array<{
      category: HarmCategory;
      threshold: HarmBlockThreshold;
    }>;
    quiet?: boolean;
  },
): Promise<T> {
  const startTime = performance.now();
  let attempts: number | undefined;

  const thinkingLevel = options?.thinkingConfig?.thinkingLevel;
  const callLabel = options?.payloadStage ?? "gemini";

  if (!options?.quiet) {
    logger?.info(`${callLabel}_start`, {
      service: "gemini",
      data: {
        model: modelName,
        instructionLength: systemInstruction.length,
        promptLength: prompt.length,
        thinkingLevel: thinkingLevel ?? undefined,
      },
    });
  }

  const thesisMatrix = options?.thesisMatrix || null;

  const safetySettings = options?.safetySettings ?? [
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
  ];

  const payload = {
    model: modelName,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      thinkingConfig: options?.thinkingConfig ?? undefined,
      seed: options?.seed ?? undefined,
      safetySettings,
    },
  };

  await logRawLlmCall({
    modelName,
    systemInstruction,
    userPrompt: prompt,
    payload,
    thesisMatrix,
    stage: options?.payloadStage,
  });

  let retryCount = 0;

  try {
    const response = await withRetry(
      async () => {
        retryCount++;
        return getAi().models.generateContent(payload);
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
        isRetryable: (error) => {
          if (error instanceof Error) {
            if (
              ("status" in error &&
                ((error as { status: string }).status === "UNAVAILABLE" ||
                  (error as { status: string }).status ===
                    "RESOURCE_EXHAUSTED")) ||
              ("code" in error &&
                ((error as { code: number }).code === 503 ||
                  (error as { code: number }).code === 429)) ||
              error.message.includes("high demand") ||
              error.message.includes("503") ||
              error.message.includes("UNAVAILABLE") ||
              error.message.includes("429") ||
              error.message.includes("quota")
            ) {
              return true;
            }
          }
          return false;
        },
        onRetry: (attempt, delay, error) => {
          const httpStatus = extractHttpStatus(error);
          logger?.warn("ai_retry_attempt", {
            service: "gemini",
            filePath: "src/lib/gemini.ts",
            step: `retry_attempt_${attempt}`,
            durationMs: delay,
            data: {
              attempt,
              maxRetries: 3,
              delayMs: Math.round(delay),
              httpStatus,
              errorMessage:
                error instanceof Error ? error.message : String(error),
            },
          });
        },
      },
    );

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
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
          "AI response did not match the expected structural schema. Please try again.",
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

    attempts = retryCount;

    // Save debug payload
    const payloadStage = options?.payloadStage ?? "gemini";
    logger?.saveDebugPayload(payloadStage, modelName, prompt, text);

    if (!options?.quiet) {
      logger?.info(`${callLabel}_success`, {
        service: "gemini",
        durationMs,
        tokens,
        data: {
          model: modelName,
          attempt: attempts,
          thinkingLevel: thinkingLevel ?? undefined,
        },
      });
    }
    return parsed;
  } catch (error) {
    const durationMs = performance.now() - startTime;
    const scenario = classifyError(error);

    // Save debug payload even on failure
    const payloadStage = options?.payloadStage ?? "gemini";
    logger?.saveDebugPayload(payloadStage, modelName, prompt);

    logger?.error(`${callLabel}_failed`, {
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
