import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Logger, createFlowId } from "@/lib/logger";
import {
  getGeminiKeyPool,
  getNextGeminiKey,
  getProjectIndex,
} from "../gemini-key-pool";
import { GEMINI_SEED } from "@/lib/constants";
import {
  SchemaValidationError,
  classifyError,
  extractHttpStatus,
  extractQuotaDetails,
  extractRetryDelayMs,
  isRateLimitError,
  isServerOverloadError,
  toAiProviderError,
} from "../llm-errors";
import {
  withRetry,
  serverOverloadDelay,
  DEFAULT_MAX_DELAY,
} from "../llm-retry";
import { sanitizeAndParseJson, validateStructuredOutput } from "../llm-json";
import type { JsonSchema, StructuredGenerationOptions } from "../llm-types";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

let aiInstance: GoogleGenAI | null = null;

const aiInstancesByKey = new Map<string, GoogleGenAI>();

/**
 * Disables the SDK's built-in HTTP retry so `withRetry` remains the single retry
 * owner. Empirically verified on @google/genai 2.16.0: the classic generateContent
 * / generateContentStream path retries ONLY when `httpOptions.retryOptions` is
 * present, and `attempts: 1` means the original request runs exactly once.
 */
const SDK_SINGLE_ATTEMPT_HTTP_OPTIONS = {
  httpOptions: { retryOptions: { attempts: 1 } },
} as const;

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
      aiInstance = new GoogleGenAI({
        apiKey: envKey,
        ...SDK_SINGLE_ATTEMPT_HTTP_OPTIONS,
      });
    }
    return aiInstance;
  }

  const cached = aiInstancesByKey.get(apiKey);
  if (cached) return cached;
  const client = new GoogleGenAI({
    apiKey,
    ...SDK_SINGLE_ATTEMPT_HTTP_OPTIONS,
  });
  aiInstancesByKey.set(apiKey, client);
  return client;
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
 * Each request is strictly bound to its assigned Google Cloud project API key with per-project 15 RPM pacing.
 *
 * @param modelName - The Gemini model identifier to call.
 * @param systemInstruction - The system-level instructions for the model.
 * @param prompt - The user prompt to send to the model.
 * @param schema - The JSON schema constraining the response shape.
 * @param logger - Optional logger for structured output and error events.
 * @param options - Optional settings for the request.
 * @returns The parsed and validated structured output of type T.
 */
export async function generateStructuredContent<T>(
  modelName: string,
  systemInstruction: string,
  prompt: string,
  schema: JsonSchema,
  logger?: Logger,
  options?: StructuredGenerationOptions<T>,
): Promise<T> {
  const scheduledTime = performance.now();

  const thinkingLevel = options?.thinkingConfig?.thinkingLevel;
  const callLabel = options?.payloadStage ?? "gemini";

  const assignedKey = options?.apiKey ?? getNextGeminiKey();
  const projectIndex = getProjectIndex(assignedKey);

  if (options?.quiet !== true) {
    logger?.info(`${callLabel}_scheduled`, {
      service: "gemini",
      data: {
        model: modelName,
        projectIndex: projectIndex + 1,
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

  const maxRetries = 3;
  let attempts = 0;

  try {
    const response = await withRetry(
      async () => getAi(assignedKey).models.generateContent(payload),
      {
        maxRetries,
        baseDelay: 2000,
        onAttempt: (attempt, previousError) => {
          attempts = attempt;
          logger?.info("ai_attempt", {
            service: "gemini",
            filePath: "src/services/ai/providers/gemini-provider.ts",
            data: {
              attempt,
              maxRetries,
              projectIndex: projectIndex + 1,
              model: modelName,
              retried: attempt > 1,
              previousError:
                previousError instanceof Error
                  ? previousError.message
                  : undefined,
            },
          });
        },
        getDelay: (attempt, error, defaultDelay) => {
          if (isServerOverloadError(error)) return serverOverloadDelay(attempt);
          if (isRateLimitError(error)) {
            const extractedDelay = extractRetryDelayMs(error);
            if (extractedDelay && extractedDelay > 0) {
              return extractedDelay + Math.random() * 500;
            }
            const capped = Math.min(
              DEFAULT_MAX_DELAY,
              2000 * Math.pow(2, attempt - 1),
            );
            return capped + Math.random() * Math.min(500, capped * 0.1);
          }
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
              error.message.includes("quota") ||
              error.message.includes("RESOURCE_EXHAUSTED")
            ) {
              return true;
            }
          }
          return false;
        },
        onRetry: (attempt, delay, error) => {
          const httpStatus = extractHttpStatus(error);
          const quotaDetails = extractQuotaDetails(error);
          const retryAfterMs = extractRetryDelayMs(error);
          logger?.info("ai_retry_attempt", {
            service: "gemini",
            filePath: "src/services/ai/providers/gemini-provider.ts",
            step: `retry_attempt_${attempt}`,
            durationMs: delay,
            data: {
              attempt,
              maxRetries,
              projectIndex: projectIndex + 1,
              crossProjectRotation: true,
              delayMs: Math.round(delay),
              retryAfterMs: retryAfterMs ?? undefined,
              httpStatus,
              quotaDetails: quotaDetails ?? undefined,
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

    try {
      validateStructuredOutput(parsed, options?.zodSchema);
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        logger?.error("ai_schema_validation_failed", {
          service: "gemini",
          filePath: "src/services/ai/providers/gemini-provider.ts",
          data: {
            model: modelName,
            projectIndex: projectIndex + 1,
            errorCount: err.zodError.issues.length,
            issues: err.zodError.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          error: new Error(`Zod validation failed: ${err.zodError.message}`),
        });
        throw new Error(
          "AI response did not match the expected structural schema. Please try again.",
        );
      }
      throw err;
    }

    const durationMs = performance.now() - scheduledTime;
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

    const payloadStage = options?.payloadStage ?? "gemini";
    logger?.saveDebugPayload(payloadStage, modelName, prompt, text);

    if (options?.quiet !== true) {
      logger?.info(`${callLabel}_success`, {
        service: "gemini",
        durationMs,
        tokens,
        data: {
          model: modelName,
          projectIndex: projectIndex + 1,
          crossProjectRotation: true,
          attempt: attempts,
          thinkingLevel: thinkingLevel ?? undefined,
        },
      });
    }
    return parsed;
  } catch (error) {
    const durationMs = performance.now() - scheduledTime;
    const scenario = classifyError(error);
    const quotaDetails = extractQuotaDetails(error);

    const payloadStage = options?.payloadStage ?? "gemini";
    logger?.saveDebugPayload(payloadStage, modelName, prompt);

    logger?.error(`${callLabel}_failed`, {
      service: "gemini",
      filePath: "src/services/ai/providers/gemini-provider.ts",
      durationMs,
      data: {
        model: modelName,
        projectIndex: projectIndex + 1,
        crossProjectRotation: true,
        attempts,
        thinkingLevel: thinkingLevel ?? undefined,
        scenario,
        quotaDetails: quotaDetails ?? undefined,
      },
      error,
    });
    throw toAiProviderError(error, "gemini");
  }
}
