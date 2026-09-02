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

const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF]/;

/**
 * Guards against CJK leakage in Turkish academic output. Retries with perturbed seed or strips chars on final attempt.
 */
function guardCjkOutput(
  outputText: string,
  model: string,
  callLabel: string,
  attempt: number,
  maxRetries: number,
  logger: Logger | undefined,
): string {
  if (!CJK_RE.test(outputText)) return outputText;
  logger?.warn("cjk_leakage_detected", {
    service: "gemini",
    data: { model, payloadStage: callLabel, attempt },
  });
  if (attempt < maxRetries) {
    throw new Error(
      "Model output contained disallowed CJK characters (language guard violated). Retrying with perturbed seed.",
    );
  }
  return outputText.replace(new RegExp(CJK_RE, "g"), "");
}

/**
 * Validates parsed JSON against optional Zod schema, logging failures.
 */
function validateParsed<T>(
  parsed: unknown,
  zodSchema: StructuredGenerationOptions<T>["zodSchema"],
  logger: Logger | undefined,
  model: string,
  projectIndex: number,
): asserts parsed is T {
  try {
    validateStructuredOutput(parsed, zodSchema);
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      logger?.error("ai_schema_validation_failed", {
        service: "gemini",
        filePath: "src/core/services/ai/providers/gemini-provider.ts",
        data: {
          model,
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
}

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
  const thinkingLevel = options?.thinkingConfig?.thinkingLevel;
  const callLabel = options?.payloadStage ?? "gemini";
  const operation = options?.operation ?? options?.payloadStage;
  const maxRetries = 3;

  const thesisMatrix = options?.thesisMatrix || null;
  const safetySettings =
    options?.safetySettings ?? DEFAULT_GEMINI_SAFETY_SETTINGS;

  if (options?.thinkingConfig?.thinkingBudget !== undefined) {
    logger?.warn("deprecated_thinking_budget_ignored", {
      service: "gemini",
      data: {
        payloadStage: callLabel,
        thinkingBudget: options.thinkingConfig.thinkingBudget,
      },
    });
  }

  try {
    return await dispatchGeminiCall<T>({
      model: modelName,
      operation,
      lane: options?.lane,
      targetKeyIndex: options?.targetKeyIndex,
      logger,
      task: async ({ model, apiKey }) => {
        const taskStartTime = performance.now();
        const projectIndex = getProjectIndex(apiKey);

        if (options?.quiet !== true) {
          logger?.info(`${callLabel}_start`, {
            service: "gemini",
            data: {
              summary: `(${model}, key ${projectIndex + 1})`,
              model,
              projectIndex: projectIndex + 1,
              instructionLength: systemInstruction.length,
              promptLength: prompt.length,
              thinkingLevel: thinkingLevel ?? undefined,
            },
          });
        }

        // Gemini 3.x: sadece thinkingLevel iletilir, thinkingBudget ve temperature asla iletilmez.
        const sanitizedThinkingConfig = thinkingLevel
          ? { thinkingLevel: thinkingLevel }
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

          let geminiResponse: unknown = null;

          const text = await withRetry(async () => {
            const currentPayload =
              attempts > 1
                ? {
                    ...payload,
                    config: {
                      ...payload.config,
                      seed:
                        (options?.seed ?? GEMINI_SEED) + attempts * 1000 + 7,
                    },
                  }
                : payload;

            const res =
              await getAi(apiKey).models.generateContent(currentPayload);
            geminiResponse = res;
            const outputText = res.text;
            if (!outputText)
              throw new Error("Gemini returned an empty response.");
            return guardCjkOutput(
              outputText,
              model,
              callLabel,
              attempts,
              maxRetries,
              logger,
            );
          }, retryPolicy);

          const parsed = sanitizeAndParseJson<T>(text);
          validateParsed(
            parsed,
            options?.zodSchema,
            logger,
            model,
            projectIndex,
          );

          const taskDurationMs = performance.now() - taskStartTime;
          const metadata = (
            geminiResponse as unknown as {
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
              durationMs: taskDurationMs,
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
          const taskDurationMs = performance.now() - taskStartTime;
          const scenario = classifyError(error);
          const quotaDetails = extractQuotaDetails(error);

          const payloadStage = options?.payloadStage ?? "gemini";
          logger?.saveDebugPayload?.(payloadStage, model, prompt);

          if (options?.quiet !== true) {
            logger?.error(`${callLabel}_failed`, {
              service: "gemini",
              filePath: "src/core/services/ai/providers/gemini-provider.ts",
              durationMs: taskDurationMs,
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
          }
          throw error;
        }
      },
    });
  } catch (error) {
    if (isDailyQuotaExceeded(error)) {
      logger?.info("gemini_daily_quota_exhausted", {
        service: "gemini",
        filePath: "src/core/services/ai/providers/gemini-provider.ts",
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
