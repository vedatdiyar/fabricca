"use server";

import { z } from "zod";
import type { Logger } from "@/lib/logger";
import { withRetry, HttpError, DEFAULT_MAX_DELAY } from "@/lib/api-utils";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import { CEREBRAS_SEED } from "../constants";

const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";

/** Serializes Cerebras requests (max 1 in-flight) to stay within the Free Trial per-minute request ceiling. */
const cerebrasRequestQueue = createConcurrencyLimiter(1);

const CEREBRAS_RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 500,
  maxDelay: DEFAULT_MAX_DELAY,
  isRetryable: (error: unknown) => {
    if (error instanceof HttpError) {
      if (error.status === 429) return true;
      if (error.status >= 500) return true;
      return false;
    }
    return true;
  },
  getRetryAfter: (error: unknown) => {
    if (error instanceof HttpError) return error.retryAfter;
    return null;
  },
};

/**
 * Sends a chat completion to Cerebras with strict json_schema output, Full Jitter retry on 429/5xx, and a 1-in-flight concurrency cap.
 *
 * @param modelName - The Cerebras model identifier to call.
 * @param systemInstruction - The system-level instructions for the model.
 * @param prompt - The user prompt to send to the model.
 * @param jsonSchema - The JSON schema constraining the structured response.
 * @param log - Optional logger for structured output and error events.
 * @param options - Optional settings for the request.
 * @param options.payloadStage - Optional label identifying the pipeline stage.
 * @param options.zodSchema - Optional Zod schema used to validate the response.
 * @param options.temperature - Sampling temperature (0-2.0); defaults to 0 for deterministic greedy decoding.
 * @param options.seed - Fixed seed for best-effort deterministic sampling; defaults to CEREBRAS_SEED.
 * @param options.maxTokens - Maximum output tokens; defaults to 1024.
 * @param options.topP - Optional nucleus sampling threshold (0-1); omitted by default.
 * @returns The parsed and validated structured output of type T.
 */
export async function generateStructuredContent<T>(
  modelName: string,
  systemInstruction: string,
  prompt: string,
  jsonSchema: object,
  log?: Logger,
  options?: {
    payloadStage?: string;
    zodSchema?: z.ZodType<T>;
    temperature?: number;
    seed?: number;
    maxTokens?: number;
    topP?: number;
  },
): Promise<T> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    throw new Error("CEREBRAS_API_KEY environment variable is not defined");
  }

  const stage = options?.payloadStage || "cerebras";

  const temperature = options?.temperature ?? 0;
  const seed = options?.seed ?? CEREBRAS_SEED;
  const maxTokens = options?.maxTokens ?? 1024;
  const topP = options?.topP;

  log?.info(`${stage}_start`, {
    service: "cerebras",
    data: {
      model: modelName,
      promptLength: prompt.length,
      temperature,
      seed,
      maxTokens,
    },
  });

  let attempts = 0;

  const result = await withRetry<T>(
    async () => {
      attempts++;

      const response = await cerebrasRequestQueue.exec(() =>
        fetch(`${CEREBRAS_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: stage,
                strict: true,
                schema: jsonSchema,
              },
            },
            temperature,
            max_tokens: maxTokens,
            seed,
            top_p: topP,
          }),
        }),
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        const retryAfter = parseRetryAfter(response);
        throw new HttpError(response.status, errorBody, retryAfter);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Cerebras returned an empty response.");
      }

      const parsed = JSON.parse(content) as T;

      if (options?.zodSchema) {
        const validationResult = options.zodSchema.safeParse(parsed);
        if (!validationResult.success) {
          log?.error(`${stage}_schema_validation_failed`, {
            service: "cerebras",
            data: {
              issues: validationResult.error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
              })),
            },
          });
          throw new Error(
            "Cerebras response did not match the expected structural schema.",
          );
        }
      }

      return parsed;
    },
    {
      ...CEREBRAS_RETRY_CONFIG,
      onRetry(attempt, delay, error) {
        const httpStatus =
          error instanceof HttpError ? error.status : undefined;
        const retryAfter =
          error instanceof HttpError ? error.retryAfter : undefined;
        log?.info(`${stage}_retry`, {
          service: "cerebras",
          data: {
            attempt,
            maxRetries: CEREBRAS_RETRY_CONFIG.maxRetries,
            delayMs: Math.round(delay),
            httpStatus,
            retryAfter,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        });
      },
    },
  );

  log?.info(`${stage}_success`, {
    service: "cerebras",
    data: { model: modelName, attempts },
  });

  return result;
}

/**
 * Parses the `Retry-After` header into milliseconds, or null when absent or in HTTP-date format.
 *
 * @param response - The HTTP response whose Retry-After header is read.
 * @returns The retry delay in milliseconds, or null when the header is absent or unusable.
 */
function parseRetryAfter(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  if (!header) return null;

  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  return null;
}
