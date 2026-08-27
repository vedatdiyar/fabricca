import type { Logger } from "@/lib/logger";
import { getProjectIndex } from "../gemini-key-pool";
import { dispatchGeminiCall } from "../gemini-scheduler";
import { GEMINI_SEED } from "@/lib/constants";
import {
  SchemaValidationError,
  classifyError,
  extractQuotaDetails,
  toAiProviderError,
} from "../llm-errors";
import { withRetry } from "../llm-retry";
import { sanitizeAndParseJson, validateStructuredOutput } from "../llm-json";
import type { JsonSchema, StructuredGenerationOptions } from "../llm-types";
import {
  DailyQuotaExceededError,
  isDailyQuotaExceeded,
} from "@/lib/rate-limiter";
import { getAi } from "./gemini-client";
import { logRawLlmCall } from "./gemini-debug-logger";
import { DEFAULT_GEMINI_SAFETY_SETTINGS } from "./gemini-config";
import { createGeminiRetryPolicy } from "./gemini-retry-policy";

export { getAi, logRawLlmCall };

/**
 * Requests structured JSON output from Gemini via responseJsonSchema, with retry on 429/5xx and optional Zod validation.
 * Every call is dispatched through the quota-aware key scheduler, which binds it
 * to a healthy `(model, apiKey)` pair, round-robins parallel fan-outs, and
 * falls back to a weaker model only for loss-less operations.
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
  const operation = options?.operation;
  const maxRetries = 3;

  const thesisMatrix = options?.thesisMatrix || null;
  const safetySettings =
    options?.safetySettings ?? DEFAULT_GEMINI_SAFETY_SETTINGS;

  // Gemini 3.x: thinkingBudget ve temperature/topP/topK iletilmez.
  // Sadece thinkingLevel kullanılır; sıcaklık determinizmi seed + net talimatlarla sağlanır.
  if (options?.thinkingConfig?.thinkingBudget !== undefined) {
    logger?.warn("deprecated_thinking_budget_ignored", {
      service: "gemini",
      data: { payloadStage: callLabel, thinkingBudget: options.thinkingConfig.thinkingBudget },
    });
  }

  try {
    return await dispatchGeminiCall<T>({
      model: modelName,
      operation,
      task: async ({ model, apiKey }) => {
        const projectIndex = getProjectIndex(apiKey);

        if (options?.quiet !== true) {
          logger?.info(`${callLabel}_scheduled`, {
            service: "gemini",
            data: {
              model,
              projectIndex: projectIndex + 1,
              instructionLength: systemInstruction.length,
              promptLength: prompt.length,
              thinkingLevel: thinkingLevel ?? undefined,
            },
          });
        }

        // Gemini 3.x: sadece thinkingLevel iletilir, thinkingBudget ve temperature asla iletilmez.
        const sanitizedThinkingConfig = options?.thinkingConfig?.thinkingLevel
          ? { thinkingLevel: options.thinkingConfig.thinkingLevel }
          : undefined;

        const payload = {
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
            thinkingConfig: sanitizedThinkingConfig,
            seed: options?.seed ?? GEMINI_SEED,
            safetySettings,
          },
        };

        await logRawLlmCall({
          modelName: model,
          systemInstruction,
          userPrompt: prompt,
          payload,
          thesisMatrix,
          stage: options?.payloadStage,
        });

        let attempts = 0;

        try {
          const retryPolicy = createGeminiRetryPolicy({
            model,
            projectIndex,
            maxRetries,
            logger,
            onAttemptCallback: (att) => {
              attempts = att;
            },
          });

          const response = await withRetry(
            async () => getAi(apiKey).models.generateContent(payload),
            retryPolicy,
          );

          const text = response.text;
          if (!text) {
            throw new Error("Gemini returned an empty response.");
          }

          // CJK sızma guardı: Lite tier Türkçe akademik çıktıda nadiren Han/Kana üretir.
          // Tespit edilirse retry tetiklemek için hata fırlatılır.
          const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF]/;
          if (CJK_RE.test(text)) {
            logger?.warn("cjk_leakage_detected", {
              service: "gemini",
              data: { model, payloadStage: callLabel },
            });
            throw new Error(
              "Model output contained disallowed CJK characters (language guard violated). Retrying.",
            );
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
                  model,
                  projectIndex: projectIndex + 1,
                  errorCount: err.zodError.issues.length,
                  issues: err.zodError.issues.map((i) => ({
                    path: i.path.join("."),
                    message: i.message,
                  })),
                },
                error: new Error(
                  `Zod validation failed: ${err.zodError.message}`,
                ),
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
          logger?.saveDebugPayload?.(payloadStage, model, prompt, text);

          if (options?.quiet !== true) {
            logger?.info(`${callLabel}_success`, {
              service: "gemini",
              durationMs,
              tokens,
              data: {
                model,
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
          logger?.saveDebugPayload?.(payloadStage, model, prompt);

          logger?.error(`${callLabel}_failed`, {
            service: "gemini",
            filePath: "src/services/ai/providers/gemini-provider.ts",
            durationMs,
            data: {
              model,
              projectIndex: projectIndex + 1,
              crossProjectRotation: true,
              attempts,
              thinkingLevel: thinkingLevel ?? undefined,
              scenario,
              quotaDetails: quotaDetails ?? undefined,
            },
            error,
          });
          throw error;
        }
      },
    });
  } catch (error) {
    if (isDailyQuotaExceeded(error)) {
      logger?.info("gemini_daily_quota_exhausted", {
        service: "gemini",
        filePath: "src/services/ai/providers/gemini-provider.ts",
        data: {
          model: modelName,
          operation: operation ?? undefined,
        },
      });
      throw new DailyQuotaExceededError(`gemini_${modelName}`);
    }
    throw toAiProviderError(error, "gemini");
  }
}
