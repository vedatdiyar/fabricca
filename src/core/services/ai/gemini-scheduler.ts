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
import {
  GEMINI_FALLBACK_CHAINS,
  GEMINI_FALLBACK_OPERATIONS,
} from "@/core/config/rate-limits";
import { DailyQuotaExceededError } from "@/lib/rate-limiter";
import { getGeminiKeyPool } from "./gemini-key-pool";
import { isRateLimitError, isRpdError } from "./llm-errors";
import {
  markKeyRpdExhausted,
  markKeyRpmCoolingDown,
  recordKeyUsage,
  getKeyUsageStats,
  resetGeminiScheduler,
} from "./scheduler-state";
import { getBalancedKeyCandidates } from "./candidate-selector";

export { getKeyUsageStats, resetGeminiScheduler };

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
    params.operation !== undefined &&
    GEMINI_FALLBACK_OPERATIONS.some((op) => op === params.operation);
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
      try {
        const result = await params.task({ model, apiKey });
        // Increment usage count for balanced tracking
        recordKeyUsage(apiKey);
        return result;
      } catch (error) {
        if (isRpdError(error)) {
          markKeyRpdExhausted(model, apiKey);
          if (i < keyIndicesToTry.length - 1) {
            continue;
          }
        } else if (isRateLimitError(error)) {
          markKeyRpmCoolingDown(model, apiKey);
          if (i < keyIndicesToTry.length - 1) {
            continue;
          }
        }

        // If this is the last key attempt on the last available model, throw
        if (
          i === keyIndicesToTry.length - 1 &&
          model === models[models.length - 1]
        ) {
          throw error;
        }
      }
    }
  }

  throw new DailyQuotaExceededError(`gemini_${params.model}`);
}
