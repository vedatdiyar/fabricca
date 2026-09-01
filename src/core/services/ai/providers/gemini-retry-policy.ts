import type { Logger } from "@/lib/logger";
import {
  isRateLimitError,
  isRpdError,
  isServerOverloadError,
  extractHttpStatus,
  extractQuotaDetails,
  extractRetryDelayMs,
} from "../llm-errors";
import {
  type RetryOptions,
  serverOverloadDelay,
  DEFAULT_MAX_DELAY,
} from "../llm-retry";

export interface GeminiRetryPolicyParams {
  model: string;
  projectIndex: number;
  maxRetries?: number;
  logger?: Logger;
  onAttemptCallback?: (attempt: number) => void;
}

/**
 * Creates the retry policy and callbacks for executing a Gemini API call with `withRetry`.
 *
 * @param params - Configuration including model, projectIndex, and logger.
 * @returns Configured RetryOptions for withRetry.
 */
export function createGeminiRetryPolicy(
  params: GeminiRetryPolicyParams,
): RetryOptions {
  const {
    model,
    projectIndex,
    maxRetries = 3,
    logger,
    onAttemptCallback,
  } = params;

  return {
    maxRetries,
    baseDelay: 2000,
    onAttempt: (attempt, previousError) => {
      onAttemptCallback?.(attempt);
      if (attempt > 1) {
        logger?.retry("gemini", {
          service: "gemini",
          filePath: "src/services/ai/providers/gemini-provider.ts",
          error: previousError,
          data: {
            summary: `(attempt ${attempt}/${maxRetries}, key ${projectIndex + 1})`,
            attempt,
            maxRetries,
            projectIndex: projectIndex + 1,
            model,
          },
        });
      }
    },
    getDelay: (attempt, error, defaultDelay) => {
      if (isServerOverloadError(error)) {
        return serverOverloadDelay(attempt);
      }
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
        // If it's an RPD (Daily Quota) error, do not retry on the same key;
        // let dispatchGeminiCall immediately switch to the next API key!
        if (isRpdError(error)) {
          return false;
        }

        // If it's an RPM rate limit error, retry with backoff on the current key
        // to let the sliding window recover before falling back to scheduler rotation.
        if (isRateLimitError(error)) {
          return true;
        }

        if (
          error.message.includes("language guard violated") ||
          error.message.includes("disallowed CJK characters")
        ) {
          return true;
        }

        const isOverload =
          isServerOverloadError(error) ||
          ("status" in error &&
            (error as { status: string }).status === "UNAVAILABLE") ||
          ("code" in error && (error as { code: number }).code === 503) ||
          error.message.includes("high demand") ||
          error.message.includes("503") ||
          error.message.includes("UNAVAILABLE");

        if (isOverload) {
          // Server overload (503 / high demand) affects model capacity.
          // Fail fast immediately on the first attempt so dispatchGeminiCall can failover
          // to the configured fallback model (e.g. gemini-3.6-flash) without stalling.
          return false;
        }
      }
      return false;
    },
    onRetry: (attempt, delay, error) => {
      const httpStatus = extractHttpStatus(error);
      const quotaDetails = extractQuotaDetails(error);
      const retryAfterMs = extractRetryDelayMs(error);
      logger?.info("gemini_retry", {
        service: "gemini",
        status: "RETRY",
        filePath: "src/services/ai/providers/gemini-provider.ts",
        step: `retry_attempt_${attempt}`,
        durationMs: delay,
        error,
        data: {
          summary: `(attempt ${attempt}/${maxRetries}, key ${projectIndex + 1})`,
          attempt,
          maxRetries,
          projectIndex: projectIndex + 1,
          crossProjectRotation: true,
          delayMs: Math.round(delay),
          retryAfterMs: retryAfterMs ?? undefined,
          httpStatus,
          quotaDetails: quotaDetails ?? undefined,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    },
  };
}
