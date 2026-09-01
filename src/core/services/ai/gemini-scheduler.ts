/**
 * Balanced Least-Used & Round-Robin Gemini key dispatcher.
 *
 * Distributes LLM calls evenly across all configured Gemini API keys in the pool.
 * Under normal conditions, requests cycle in balanced round-robin (Key 1 -> Key 2 -> Key 3 -> Key 1...).
 * If a key encounters a temporary RPM rate limit, it enters a 60-second cooldown while
 * remaining healthy keys seamlessly absorb traffic. When it recovers, the least-used balancer
 * naturally catches it up, preserving equal utilization across all keys.
 * If a key exhausts its daily quota (RPD), it fails over to healthy keys until midnight.
 */
import type { Logger } from "@/lib/logger";
import {
  GEMINI_FALLBACK_CHAINS,
  GEMINI_FALLBACK_OPERATIONS,
} from "@/core/config/rate-limits";
import { DailyQuotaExceededError } from "@/lib/rate-limiter";
import { getGeminiKeyPool } from "./gemini-key-pool";
import {
  isRateLimitError,
  isRpdError,
  isServerOverloadError,
  isTimeoutError,
} from "./llm-errors";
import {
  markKeyRpdExhausted,
  markKeyRpmCoolingDown,
  recordKeyUsage,
  incrementInFlight,
  decrementInFlight,
  getKeyUsageStats,
  resetGeminiScheduler,
} from "./scheduler-state";
import { getBalancedKeyCandidates } from "./candidate-selector";

export { getKeyUsageStats, resetGeminiScheduler };

/** Client timeout in milliseconds for the primary model when a fallback model exists (45s). */
export const GEMINI_PRIMARY_MODEL_TIMEOUT_MS = 45_000;

/**
 * Wraps a promise with a timeout deadline in milliseconds.
 *
 * @param promise - The promise to await.
 * @param timeoutMs - Maximum allowed duration in milliseconds.
 * @param timeoutErrorMsg - Error message to throw if timeout expires.
 * @returns The resolved value of the promise.
 */
function withPromiseTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutErrorMsg: string,
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(timeoutErrorMsg);
      err.name = "TimeoutError";
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** The `(model, apiKey)` pair a Gemini call is dispatched on. */
export interface GeminiTarget {
  /** The model actually called (may be the fallback model). */
  model: string;
  /** The API key assigned to this call. */
  apiKey: string;
}

export interface GeminiDispatchParams<T> {
  /** The preferred model for the operation. */
  model: string;
  /**
   * Pipeline operation key. When present and listed in
   * `GEMINI_FALLBACK_OPERATIONS`, a model fallback may be attempted.
   */
  operation?: string;
  /** Optional logger to output key rotation and scheduler events. */
  logger?: Logger;
  /**
   * Runs the actual LLM call under the resolved target.
   */
  task: (target: GeminiTarget) => Promise<T>;
}

/**
 * Dispatches a Gemini call across available API keys using balanced least-used round-robin distribution.
 * Guarantees fair, equal traffic across all configured keys while automatically failing over
 * upon temporary RPM rate limits or daily RPD exhaustion.
 *
 * @typeParam T - The structured output type produced by the task.
 * @param params - The dispatch parameters (preferred model, operation, task).
 * @returns The task result.
 */
export async function dispatchGeminiCall<T>(
  params: GeminiDispatchParams<T>,
): Promise<T> {
  const pool = getGeminiKeyPool().keys;
  if (pool.length === 0) {
    throw new DailyQuotaExceededError(`gemini_${params.model}`);
  }

  const allowFallback =
    params.operation !== undefined
      ? GEMINI_FALLBACK_OPERATIONS.some((op) => op === params.operation) ||
        Boolean(GEMINI_FALLBACK_CHAINS[params.model])
      : Boolean(GEMINI_FALLBACK_CHAINS[params.model]);
  const fallback = allowFallback
    ? (GEMINI_FALLBACK_CHAINS[params.model] ?? null)
    : null;

  const models =
    fallback && fallback !== params.model
      ? [params.model, fallback]
      : [params.model];

  for (const model of models) {
    const keyIndicesToTry = getBalancedKeyCandidates(model, pool);
    if (keyIndicesToTry.length === 0) {
      continue;
    }

    for (let i = 0; i < keyIndicesToTry.length; i++) {
      const apiKey = pool[keyIndicesToTry[i]];
      incrementInFlight(apiKey);
      try {
        const isPrimaryWithFallback = model !== models[models.length - 1];
        const taskPromise = params.task({ model, apiKey });
        const result = isPrimaryWithFallback
          ? await withPromiseTimeout(
              taskPromise,
              GEMINI_PRIMARY_MODEL_TIMEOUT_MS,
              `Model ${model} request exceeded client timeout (${GEMINI_PRIMARY_MODEL_TIMEOUT_MS / 1000}s)`,
            )
          : await taskPromise;

        // Increment usage count for balanced tracking
        recordKeyUsage(apiKey);
        return result;
      } catch (error) {
        const currentKeyIdx = keyIndicesToTry[i];
        if (isRpdError(error)) {
          markKeyRpdExhausted(model, apiKey);
        } else if (isRateLimitError(error)) {
          markKeyRpmCoolingDown(model, apiKey);
        }

        const isOverload = isServerOverloadError(error);
        const isTimeout = isTimeoutError(error);

        // 503 / High demand overload or 45s Timeout is a model-level capacity constraint affecting all keys.
        // If a fallback model is configured, immediately failover to the next model without
        // spinning through all other keys on the overloaded model.
        if ((isOverload || isTimeout) && model !== models[models.length - 1]) {
          const nextModel = models[models.indexOf(model) + 1];
          params.logger?.info("gemini_model_fallback_retry", {
            service: "gemini",
            status: "RETRY",
            data: {
              summary: isTimeout
                ? `(model ${model} timed out after ${GEMINI_PRIMARY_MODEL_TIMEOUT_MS / 1000}s, falling back to ${nextModel})`
                : `(model ${model} overloaded [503/high-demand], falling back to ${nextModel})`,
              fromModel: model,
              toModel: nextModel,
              reason: isTimeout ? "client_timeout" : "server_overload",
            },
          });
          break;
        }

        if (i < keyIndicesToTry.length - 1) {
          const nextKeyIdx = keyIndicesToTry[i + 1];
          params.logger?.info("gemini_key_rotate_retry", {
            service: "gemini",
            status: "RETRY",
            data: {
              summary: `(key ${currentKeyIdx + 1} failed, rotating to key ${nextKeyIdx + 1}/${pool.length})`,
              fromKey: currentKeyIdx + 1,
              toKey: nextKeyIdx + 1,
              totalKeys: pool.length,
              model,
            },
          });
          continue;
        }

        // If this is the last key attempt on the current model, but a fallback model is available
        if (
          i === keyIndicesToTry.length - 1 &&
          model !== models[models.length - 1]
        ) {
          const nextModel = models[models.indexOf(model) + 1];
          params.logger?.info("gemini_model_fallback_retry", {
            service: "gemini",
            status: "RETRY",
            data: {
              summary: `(all keys failed on ${model}, falling back to ${nextModel})`,
              fromModel: model,
              toModel: nextModel,
            },
          });
        }

        // If this is the last key attempt on the last available model, throw
        if (
          i === keyIndicesToTry.length - 1 &&
          model === models[models.length - 1]
        ) {
          throw error;
        }
      } finally {
        decrementInFlight(apiKey);
      }
    }
  }

  throw new DailyQuotaExceededError(`gemini_${params.model}`);
}
