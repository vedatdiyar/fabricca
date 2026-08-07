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
import { GEMINI_SEED } from "../constants";
import { getGeminiKeyPool, nextKeyPosition } from "./gemini-key-pool";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export interface JsonSchemaProperty {
  type: string | string[];
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

const aiInstancesByKey = new Map<string, GoogleGenAI>();

/**
 * Returns a lazily-initialized GoogleGenAI client, defaulting to the GEMINI_API_KEY_1
 * environment variable or a per-key cached client when an explicit key is provided.
 *
 * @param apiKey - Optional Gemini API key override for multi-key load distribution.
 * @returns The shared GoogleGenAI instance.
 */
export function getAi(apiKey?: string): GoogleGenAI {
  if (!apiKey) {
    if (!aiInstance) {
      const envKey = getGeminiKeyPool().keys[0];
      aiInstance = new GoogleGenAI({ apiKey: envKey });
    }
    return aiInstance;
  }

  const cached = aiInstancesByKey.get(apiKey);
  if (cached) return cached;
  const client = new GoogleGenAI({ apiKey });
  aiInstancesByKey.set(apiKey, client);
  return client;
}

/**
 * Extracts a human-readable HTTP status label from a thrown Gemini error.
 *
 * @param error - The thrown error to inspect.
 * @returns The formatted HTTP status string, or "unknown" when it cannot be determined.
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

    if (error.message.includes("429") || error.message.includes("quota"))
      return "429 (RESOURCE_EXHAUSTED)";
    if (error.message.includes("503") || error.message.includes("UNAVAILABLE"))
      return "503 (UNAVAILABLE)";
  }
  return "unknown";
}

/**
 * Determines whether a thrown Gemini error is a rate-limit (RPM/RPD/quota) failure.
 *
 * @param error - The thrown error to inspect.
 * @returns True when the error indicates the current key exhausted its rate limit.
 */
function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const err = error as unknown as Record<string, unknown>;
  const status = typeof err.status === "string" ? err.status : "";
  const code = typeof err.code === "number" ? err.code : 0;
  if (status === "RESOURCE_EXHAUSTED" || code === 429) return true;
  const message = error.message.toLowerCase();
  return (
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("rpd") ||
    message.includes("rpm")
  );
}

/**
 * Determines whether a thrown Gemini error is a server-side overload (503 / UNAVAILABLE)
 * that affects all keys and is best handled with a long backoff rather than key rotation.
 *
 * @param error - The thrown error to inspect.
 * @returns True when the error indicates a server-side overload.
 */
function isServerOverloadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const err = error as unknown as Record<string, unknown>;
  const status = typeof err.status === "string" ? err.status : "";
  const code = typeof err.code === "number" ? err.code : 0;
  if (code === 503 || status === "UNAVAILABLE") return true;
  const message = error.message.toLowerCase();
  return (
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("high demand")
  );
}

/**
 * Computes a long exponential backoff plus small jitter for server overload (503) retries.
 *
 * @param attempt - The 1-based retry attempt number.
 * @returns The delay in milliseconds, capped at 45s with a small jitter.
 */
function serverOverloadDelay(attempt: number): number {
  const capped = Math.min(45_000, 1000 * Math.pow(3, attempt - 1));
  return capped + Math.random() * Math.min(2000, capped * 0.25);
}

/**
 * Strips markdown code fences from a raw text response and parses it as JSON.
 *
 * @param text - The raw model response text.
 * @returns The parsed JSON value cast to type T.
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
 * In development, persists a hashed record of LLM inputs to `.next/logs/llm_inputs` for debugging.
 *
 * @param params - Object containing the model name, prompts, payload, thesis matrix, and optional stage label.
 * @param params.modelName - The Gemini model identifier used for the call.
 * @param params.systemInstruction - The system-level instructions sent to the model.
 * @param params.userPrompt - The user prompt sent to the model.
 * @param params.payload - The raw request payload sent to the model.
 * @param params.thesisMatrix - The thesis matrix context included in the log.
 * @param params.stage - Optional label identifying the pipeline stage.
 * @returns The SHA-256 hash of the logged inputs, or undefined when logging is skipped.
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
    log.error("write_llm_log_failed", {
      service: "gemini",
      data: { error: String(err) },
    });
  }

  return hash;
}

/**
 * Requests structured JSON output from Gemini via responseJsonSchema, with retry on 429/5xx and optional Zod validation.
 *
 * @param modelName - The Gemini model identifier to call.
 * @param systemInstruction - The system-level instructions for the model.
 * @param prompt - The user prompt to send to the model.
 * @param schema - The JSON schema constraining the response shape.
 * @param logger - Optional logger for structured output and error events.
 * @param options - Optional settings for the request.
 * @param options.thinkingConfig - Optional thinking level and budget configuration.
 * @param options.payloadStage - Optional label identifying the pipeline stage.
 * @param options.zodSchema - Optional Zod schema used to validate the response.
 * @param options.seed - Optional random seed for deterministic output.
 * @param options.thesisMatrix - Optional thesis matrix context for the model.
 * @param options.safetySettings - Optional safety category and threshold overrides.
 * @param options.quiet - When false, logs start/success events to the logger.
 * @param options.apiKey - Optional Gemini API key override for multi-key load distribution.
 * @returns The parsed and validated structured output of type T.
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
      thinkingBudget?: number;
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
    apiKey?: string;
  },
): Promise<T> {
  const startTime = performance.now();
  let attempts: number | undefined;

  const thinkingLevel = options?.thinkingConfig?.thinkingLevel;
  const callLabel = options?.payloadStage ?? "gemini";

  if (options?.quiet === false) {
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
      seed: options?.seed ?? GEMINI_SEED,
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

  const keyPool = getGeminiKeyPool();
  const startingKey = options?.apiKey ?? keyPool.keys[0];
  let activePosition = Math.max(0, keyPool.keys.indexOf(startingKey));
  let activeKey = keyPool.keys[activePosition];
  const maxRetries = Math.max(3, keyPool.keys.length);

  try {
    const response = await withRetry(
      async () => {
        retryCount++;
        return getAi(activeKey).models.generateContent(payload);
      },
      {
        maxRetries,
        baseDelay: 1000,
        getDelay: (attempt, error, defaultDelay) => {
          if (isServerOverloadError(error)) return serverOverloadDelay(attempt);
          if (isRateLimitError(error)) return 0;
          return defaultDelay;
        },
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
          if (isRateLimitError(error) && keyPool.keys.length > 1) {
            activePosition = nextKeyPosition(
              activePosition,
              keyPool.keys.length,
            );
            activeKey = keyPool.keys[activePosition];
          }
          const httpStatus = extractHttpStatus(error);
          logger?.info("ai_retry_attempt", {
            service: "gemini",
            filePath: "src/lib/gemini.ts",
            step: `retry_attempt_${attempt}`,
            durationMs: delay,
            data: {
              attempt,
              maxRetries,
              keyPositions: keyPool.keys.length,
              activePosition,
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

    const payloadStage = options?.payloadStage ?? "gemini";
    logger?.saveDebugPayload(payloadStage, modelName, prompt, text);

    if (options?.quiet === false) {
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
