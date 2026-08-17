/**
 * Quota-aware Gemini key scheduler.
 *
 * Every `generateStructuredContent` request is dispatched through this module,
 * which binds the call to a `(model, apiKey)` pair and runs it under that
 * pair's own per-minute token bucket + Pacific-midnight daily counter:
 *
 * - RPM: simultaneous calls wait in line (burst up to the ceiling, never overflow).
 * - RPD: keys whose daily quota is spent are skipped; rotation is round-robin
 *   and always starts from the last-used position so parallel fan-outs spread
 *   evenly across every available key.
 * - Fallback (loss-less ops only): when every key is daily-exhausted for the
 *   preferred model, `GEMINI_FALLBACK_CHAINS` may select a weaker model whose
 *   quota is still fresh (3.5 → 3.1 for `pdf_read`/`sanitize`).
 * - Error isolation: internal retries stay on the same key; only when those are
 *   exhausted with rate-limit/server errors is the key quarantined briefly and
 *   the call rebalanced to the next healthy key. Non-quota failures abort.
 *
 * The effective caps are scaled by `GEMINI_KEY_UTILIZATION` (0.85) so one
 * failing key can be rebalanced/retried without overflowing a neighbor.
 */
import {
  GEMINI_FALLBACK_CHAINS,
  GEMINI_FALLBACK_OPERATIONS,
  GEMINI_MODEL_QUOTAS,
} from "@/config/rate-limits";
import {
  createRateLimiter,
  DailyQuotaExceededError,
  getPacificDateKey,
  type RateLimiter,
} from "@/lib/rate-limiter";
import { getGeminiKeyPool } from "./gemini-key-pool";
import { isRateLimitError, isRpdError } from "./llm-errors";

/** Cache of per-model/per-key limiters, keyed `${model}::${apiKey}`. */
const limitersByModelKey = new Map<string, RateLimiter>();

/** Keys that exhausted their daily quota (RPD), mapped `${model}::${apiKey}` → Pacific date key. */
const rpdExhaustedKeys = new Map<string, string>();

/** Rotation cursor: the next dispatch starts scanning from this key. */
let rotationCursor = 0;

/** Checks if a specific key has hit RPD exhaustion for the given model today. */
function isKeyRpdExhausted(model: string, apiKey: string): boolean {
  const cacheKey = `${model}::${apiKey}`;
  const exhaustedDate = rpdExhaustedKeys.get(cacheKey);
  if (!exhaustedDate) return false;
  const today = getPacificDateKey();
  if (exhaustedDate !== today) {
    rpdExhaustedKeys.delete(cacheKey);
    return false;
  }
  return true;
}

/** Marks a specific key as RPD exhausted for the given model today. */
function markKeyRpdExhausted(model: string, apiKey: string): void {
  const cacheKey = `${model}::${apiKey}`;
  rpdExhaustedKeys.set(cacheKey, getPacificDateKey());
}

/** Returns the shared limiter for a `(model, apiKey)` pair, creating it on first use. */
function limiterFor(model: string, apiKey: string): RateLimiter {
  const cacheKey = `${model}::${apiKey}`;
  let limiter = limitersByModelKey.get(cacheKey);
  if (!limiter) {
    const quota = GEMINI_MODEL_QUOTAS[model];
    const rpm = quota?.rpm ?? (model.includes("lite") ? 15 : 5);
    limiter = createRateLimiter({ label: `gemini_${model}`, rpm });
    limitersByModelKey.set(cacheKey, limiter);
  }
  return limiter;
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
  /**
   * When set, bypasses the round-robin cursor and pins the call to the key at
   * this 0-based index in the pool.
   */
  pinnedKeyIndex?: number;
  /**
   * When true, bypasses limiter queuing for this call.
   */
  bypassRateLimiter?: boolean;
  /**
   * Runs the actual LLM call under the resolved target.
   */
  task: (target: GeminiTarget) => Promise<T>;
}

/**
 * Dispatches a Gemini call across available API keys for the specified model.
 * When a key encounters an RPD (Daily Quota) exhaustion error, it immediately
 * switches to the next healthy API key on the SAME model.
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

  rotationCursor = (rotationCursor + 1) % pool.length;

  const startIdx =
    params.pinnedKeyIndex !== undefined
      ? params.pinnedKeyIndex % pool.length
      : rotationCursor;

  for (const model of models) {
    // Collect healthy keys first; if all keys exhausted on this model, allow trying fallback
    const keyIndices: number[] = [];
    for (let i = 0; i < pool.length; i++) {
      const idx = (startIdx + i) % pool.length;
      const apiKey = pool[idx];
      if (!isKeyRpdExhausted(model, apiKey) || pool.length === 1) {
        keyIndices.push(idx);
      }
    }

    // If all keys in pool are already marked RPD-exhausted for this model, try next model
    if (keyIndices.length === 0) {
      continue;
    }

    for (let i = 0; i < keyIndices.length; i++) {
      const apiKey = pool[keyIndices[i]];
      const limiter = limiterFor(model, apiKey);
      try {
        return params.bypassRateLimiter
          ? await params.task({ model, apiKey })
          : await limiter.exec(() => params.task({ model, apiKey }));
      } catch (error) {
        if (isRpdError(error) || isRateLimitError(error)) {
          markKeyRpdExhausted(model, apiKey);
          // If other keys exist for this same model, switch to the next key immediately
          if (i < keyIndices.length - 1) {
            continue;
          }
        }

        // If this is the last key attempt on the last available model, throw
        if (i === keyIndices.length - 1 && model === models[models.length - 1]) {
          throw error;
        }
      }
    }
  }

  throw new DailyQuotaExceededError(`gemini_${params.model}`);
}

/** Clears limiter, RPD exhaustion records, and rotation state (test/restart support). */
export function resetGeminiScheduler(): void {
  limitersByModelKey.clear();
  rpdExhaustedKeys.clear();
  rotationCursor = 0;
}


