"use server";

import { z } from "zod";
import type { Logger } from "@/lib/logger";
import { withRetry, HttpError, DEFAULT_MAX_DELAY } from "@/lib/api-utils";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";

const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";

/**
 * Module-level singleton queue — enforces a single in-flight Cerebras HTTP
 * request at a time. The Free Trial tier exposes a tight per-minute request
 * ceiling; serializing our own traffic prevents the server-side
 * `queue_exceeded` burst before it happens. Retry sleeps happen outside this
 * queue, so a waiting call can proceed while another call is backing off.
 */
const cerebrasRequestQueue = createConcurrencyLimiter(1);

const CEREBRAS_RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 500,
  maxDelay: DEFAULT_MAX_DELAY,
  isRetryable: (error: unknown) => {
    if (error instanceof HttpError) {
      // 429 is retryable (rate limit), 5xx is retryable (server fault)
      if (error.status === 429) return true;
      if (error.status >= 500) return true;
      return false;
    }
    // Network / empty-response errors: retry once
    return true;
  },
  getRetryAfter: (error: unknown) => {
    if (error instanceof HttpError) return error.retryAfter;
    return null;
  },
};

/**
 * Sends a chat completion request to the Cerebras API with structured JSON output
 * enforcement (json_schema + strict mode), Full Jitter retry on 429/5xx, and a
 * module-level concurrency cap (max 1 in-flight request) to stay within the
 * Free Trial per-minute limit. Returns the parsed, type-safe result.
 *
 * @param modelName - Cerebras model ID (e.g. "gemma-4-31b")
 * @param systemInstruction - System-level instruction / persona
 * @param prompt - User prompt
 * @param jsonSchema - JSON Schema object for structured output (must include additionalProperties: false for strict mode)
 * @param log - Optional Logger instance
 * @param options - Optional payload stage label and Zod schema for post-hoc validation
 * @returns Parsed response matching the expected type T
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
  },
): Promise<T> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    throw new Error("CEREBRAS_API_KEY environment variable is not defined");
  }

  const stage = options?.payloadStage || "cerebras";

  log?.info(`${stage}_start`, {
    service: "cerebras",
    data: { model: modelName, promptLength: prompt.length },
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
            temperature: 0,
            max_tokens: 1024,
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
 * Parses the `Retry-After` response header (RFC 9110 §10.2.3).
 * Returns a duration in milliseconds, or `null` when absent.
 */
function parseRetryAfter(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  if (!header) return null;

  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  // HTTP-date format — fall back to null
  return null;
}
