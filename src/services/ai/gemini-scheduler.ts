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
} from "@/config/rate-limits";
import { DailyQuotaExceededError, getPacificDateKey } from "@/lib/rate-limiter";
import { getGeminiKeyPool } from "./gemini-key-pool";
import { isRateLimitError, isRpdError } from "./llm-errors";

/** Keys that exhausted their daily quota (RPD), mapped `${model}::${apiKey}` → Pacific date key. */
const rpdExhaustedKeys = new Map<string, string>();

/** Keys in temporary RPM cooldown, mapped `${model}::${apiKey}` → timestamp when cooldown expires (ms). */
const rpmCooldownKeys = new Map<string, number>();

/** Total successful call count per API key string, used for least-used balancing. */
const keyUsageCounts = new Map<string, number>();

/** Round-robin sequence cursor for fair tie-breaking. */
let roundRobinCounter = 0;

/** Default cooldown duration for RPM rate limits (60 seconds). */
const DEFAULT_RPM_COOLDOWN_MS = 60_000;

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

/** Checks if a specific key is currently in temporary RPM cooldown for the given model. */
function isKeyRpmCoolingDown(model: string, apiKey: string): boolean {
  const cacheKey = `${model}::${apiKey}`;
  const expiresAt = rpmCooldownKeys.get(cacheKey);
  if (!expiresAt) return false;
  if (Date.now() >= expiresAt) {
    rpmCooldownKeys.delete(cacheKey);
    return false;
  }
  return true;
}

/** Marks a specific key as temporarily in RPM cooldown for the given model. */
function markKeyRpmCoolingDown(
  model: string,
  apiKey: string,
  durationMs = DEFAULT_RPM_COOLDOWN_MS,
): void {
  const cacheKey = `${model}::${apiKey}`;
  rpmCooldownKeys.set(cacheKey, Date.now() + durationMs);
}

/**
 * Returns prioritized key indices for dispatching, balanced by least-used metrics
 * with round-robin tie-breaking.
 *
 * @param model - The target Gemini model name.
 * @param pool - The ordered array of configured API key strings.
 * @returns Array of candidate pool indices in execution priority order.
 */
function getBalancedKeyCandidates(
  model: string,
  pool: readonly string[],
): number[] {
  // 1. Filter out keys that have hit their daily quota (RPD) today
  const nonRpdIndices: number[] = [];
  for (let i = 0; i < pool.length; i++) {
    if (!isKeyRpdExhausted(model, pool[i]) || pool.length === 1) {
      nonRpdIndices.push(i);
    }
  }

  if (nonRpdIndices.length === 0) return [];

  // 2. Separate ready keys (not in RPM cooldown) from cooling-down keys
  const readyIndices = nonRpdIndices.filter(
    (idx) => !isKeyRpmCoolingDown(model, pool[idx]),
  );

  // If all non-RPD keys happen to be in cooldown, fall back to trying all non-RPD keys
  const baseIndices = readyIndices.length > 0 ? readyIndices : nonRpdIndices;

  // 3. Apply round-robin offset for tie-breaking
  const rrOffset = roundRobinCounter++ % baseIndices.length;
  const rotated = [
    ...baseIndices.slice(rrOffset),
    ...baseIndices.slice(0, rrOffset),
  ];

  // 4. Stable sort by least-used call count
  rotated.sort((a, b) => {
    const usageA = keyUsageCounts.get(pool[a]) ?? 0;
    const usageB = keyUsageCounts.get(pool[b]) ?? 0;
    return usageA - usageB;
  });

  return rotated;
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
        keyUsageCounts.set(apiKey, (keyUsageCounts.get(apiKey) ?? 0) + 1);
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

/**
 * Returns current usage statistics across keys for diagnostics and testing.
 *
 * @returns Map of key index to total successful call count.
 */
export function getKeyUsageStats(): Record<number, number> {
  const pool = getGeminiKeyPool().keys;
  const stats: Record<number, number> = {};
  for (let i = 0; i < pool.length; i++) {
    stats[i + 1] = keyUsageCounts.get(pool[i]) ?? 0;
  }
  return stats;
}

/** Clears RPD exhaustion, RPM cooldown, and usage records (test/restart support). */
export function resetGeminiScheduler(): void {
  rpdExhaustedKeys.clear();
  rpmCooldownKeys.clear();
  keyUsageCounts.clear();
  roundRobinCounter = 0;
}
