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
  GEMINI_KEY_UTILIZATION,
  GEMINI_MODEL_QUOTAS,
} from "@/config/rate-limits";
import {
  createRateLimiter,
  DailyQuotaExceededError,
  isDailyQuotaExceeded,
  type RateLimiter,
} from "@/lib/rate-limiter";
import { getGeminiKeyPool } from "./gemini-key-pool";
import { isRateLimitError, isServerOverloadError } from "./llm-errors";

/** How long a key stays quarantined after exhausting its retry budget. */
const KEY_COOLDOWN_MS = 30_000;

/** Cache of per-model/per-key limiters, keyed `${model}::${apiKey}`. */
const limitersByModelKey = new Map<string, RateLimiter>();

/** Keys currently in cooldown, keyed by apiKey → cooldown end timestamp. */
const keyCooldowns = new Map<string, number>();

/** Rotation cursor: the next dispatch starts scanning from this key. */
let rotationCursor = 0;

/** Effective (utilization-scaled) quota caps for a Gemini model. */
function effectiveCaps(model: string): { rpm: number; rpd: number } | null {
  const quota = GEMINI_MODEL_QUOTAS[model];
  if (!quota) return null;
  return {
    rpm: Math.max(1, Math.floor(quota.rpm * GEMINI_KEY_UTILIZATION)),
    rpd: Math.max(1, Math.floor(quota.rpd * GEMINI_KEY_UTILIZATION)),
  };
}

/** Returns the shared limiter for a `(model, apiKey)` pair, creating it on first use. */
function limiterFor(model: string, apiKey: string): RateLimiter {
  const cacheKey = `${model}::${apiKey}`;
  let limiter = limitersByModelKey.get(cacheKey);
  if (!limiter) {
    const caps = effectiveCaps(model);
    if (!caps) {
      throw new Error(`Unknown Gemini quota for model "${model}".`);
    }
    limiter = createRateLimiter({ label: `gemini_${model}`, ...caps });
    limitersByModelKey.set(cacheKey, limiter);
  }
  return limiter;
}

/** True while the key is quarantined in cooldown. */
function isCoolingDown(apiKey: string): boolean {
  const until = keyCooldowns.get(apiKey);
  return until !== undefined && until > Date.now();
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
   * `GEMINI_FALLBACK_OPERATIONS`, a model fallback may be attempted after
   * every key's daily quota for the preferred model is spent.
   */
  operation?: string;
  /**
   * Runs the actual LLM call under the resolved target. Executed through the
   * target's quota limiter; internal retries stay on the same key.
   */
  task: (target: GeminiTarget) => Promise<T>;
}

/**
 * Dispatches a Gemini call to a healthy `(model, apiKey)` pair, applying
 * round-robin rotation, daily-quota skipping, loss-less model fallback, and
 * per-key cooldown on repeated quota/server failures.
 *
 * @typeParam T - The structured output type produced by the task.
 * @param params - The dispatch parameters (preferred model, operation, task).
 * @returns The task result.
 * @throws `DailyQuotaExceededError` when every key (and fallback, if any) is exhausted.
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

  for (const model of models) {
    const candidates: Array<{ apiKey: string; limiter: RateLimiter }> = [];
    for (let i = 0; i < pool.length; i++) {
      const apiKey = pool[(rotationCursor + i) % pool.length];
      if (isCoolingDown(apiKey)) continue;
      const limiter = limiterFor(model, apiKey);
      if (limiter.hasDailyCapacity()) {
        candidates.push({ apiKey, limiter });
      }
    }

    if (candidates.length === 0) continue;

    for (const candidate of candidates) {
      try {
        const value = await candidate.limiter.exec(() =>
          params.task({ model, apiKey: candidate.apiKey }),
        );
        keyCooldowns.delete(candidate.apiKey);
        return value;
      } catch (error) {
        if (isDailyQuotaExceeded(error)) continue;
        if (isRateLimitError(error) || isServerOverloadError(error)) {
          keyCooldowns.set(candidate.apiKey, Date.now() + KEY_COOLDOWN_MS);
          continue;
        }
        throw error;
      }
    }
  }

  throw new DailyQuotaExceededError(`gemini_${params.model}`);
}

/** Clears key cooldowns and rotation state (test/restart support). */
export function resetGeminiScheduler(): void {
  limitersByModelKey.clear();
  keyCooldowns.clear();
  rotationCursor = 0;
}
