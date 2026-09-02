import { getPacificDateKey } from "@/lib/rate-limiter";
import { getGeminiKeyPool } from "./gemini-key-pool";
import { GEMINI_MODEL_QUOTAS } from "@/core/config/rate-limits";

/** Keys that exhausted their daily quota (RPD), mapped `${model}::${apiKey}` → Pacific date key. */
const rpdExhaustedKeys = new Map<string, string>();

/** Keys in temporary RPM cooldown, mapped `${model}::${apiKey}` → timestamp when cooldown expires (ms). */
const rpmCooldownKeys = new Map<string, number>();

/** Total successful call count per API key string, used for least-used balancing. */
const keyUsageCounts = new Map<string, number>();

/** Active in-flight requests currently executing per API key string. */
const keyInFlightCounts = new Map<string, number>();

/** Round-robin sequence cursor for fair tie-breaking. */
let roundRobinCounter = 0;

/** Default cooldown duration for RPM rate limits (15 seconds, matching sliding window recovery). */
export const DEFAULT_RPM_COOLDOWN_MS = 15_000;

/** Proactive daily request counts per (model::key), keyed by `${model}::${apiKey}` → { dateKey, count }. */
const dailyKeyCounts = new Map<string, { dateKey: string; count: number }>();

/**
 * Returns the configured RPD limit for a model (per key, per day).
 * Fail-open: returns Infinity if model not found so proactive gate never blocks.
 */
function getRpdForModel(model: string): number {
  try {
    const quota = GEMINI_MODEL_QUOTAS[model];
    return quota?.rpd ?? Infinity;
  } catch (err) {
    console.warn(`[scheduler-state] getRpdForModel failed for ${model}, fail-open:`, err);
    return Infinity;
  }
}

/** Increments active in-flight request count for an API key. */
export function incrementInFlight(apiKey: string): void {
  keyInFlightCounts.set(apiKey, (keyInFlightCounts.get(apiKey) ?? 0) + 1);
}

/** Decrements active in-flight request count for an API key. */
export function decrementInFlight(apiKey: string): void {
  const current = keyInFlightCounts.get(apiKey) ?? 0;
  if (current <= 1) {
    keyInFlightCounts.delete(apiKey);
  } else {
    keyInFlightCounts.set(apiKey, current - 1);
  }
}

/** Returns the active in-flight request count for an API key. */
export function getKeyInFlightCount(apiKey: string): number {
  return keyInFlightCounts.get(apiKey) ?? 0;
}

/** Checks if a specific key has hit RPD exhaustion for the given model today. */
export function isKeyRpdExhausted(model: string, apiKey: string): boolean {
  // Reactive: explicit 429 RPD mark
  const cacheKey = `${model}::${apiKey}`;
  const exhaustedDate = rpdExhaustedKeys.get(cacheKey);
  if (exhaustedDate) {
    const today = getPacificDateKey();
    if (exhaustedDate !== today) {
      rpdExhaustedKeys.delete(cacheKey);
    } else {
      return true;
    }
  }
  // Proactive: daily counter >= RPD limit (Pacific date-key)
  try {
    const rpd = getRpdForModel(model);
    if (Number.isFinite(rpd)) {
      const entry = dailyKeyCounts.get(cacheKey);
      const today = getPacificDateKey();
      if (entry && entry.dateKey === today && entry.count >= rpd) {
        return true;
      }
    }
  } catch (err) {
    console.warn(`[scheduler-state] isKeyRpdExhausted proactive check failed for ${model}, fail-open:`, err);
  }
  return false;
}

/** Marks a specific key as RPD exhausted for the given model today. */
export function markKeyRpdExhausted(model: string, apiKey: string): void {
  const cacheKey = `${model}::${apiKey}`;
  rpdExhaustedKeys.set(cacheKey, getPacificDateKey());
  // Also saturate proactive counter to RPD limit so hasDailyCapacity checks fail (dual-link)
  try {
    const rpd = getRpdForModel(model);
    if (Number.isFinite(rpd)) {
      dailyKeyCounts.set(cacheKey, { dateKey: getPacificDateKey(), count: rpd });
    }
  } catch (err) {
    console.warn(`[scheduler-state] markKeyRpdExhausted proactive saturation failed for ${model}, fail-open:`, err);
  }
}

// ── Proactive daily counters (Pacific date-key, per model::key) ──

/** Returns current proactive daily count for a model::key (0 if none or date rolled). Fail-open. */
export function getDailyCountForKey(model: string, apiKey: string): number {
  try {
    const cacheKey = `${model}::${apiKey}`;
    const entry = dailyKeyCounts.get(cacheKey);
    const today = getPacificDateKey();
    if (!entry || entry.dateKey !== today) return 0;
    return entry.count;
  } catch (err) {
    console.warn(`[scheduler-state] getDailyCountForKey failed for ${model}, fail-open:`, err);
    return 0;
  }
}

/** Atomically increments proactive daily counter for a model::key. Fail-open, best-effort DB sync. */
export function incrementDailyForKey(model: string, apiKey: string): number {
  try {
    const cacheKey = `${model}::${apiKey}`;
    const today = getPacificDateKey();
    const entry = dailyKeyCounts.get(cacheKey);
    let newCount: number;
    if (!entry || entry.dateKey !== today) {
      dailyKeyCounts.set(cacheKey, { dateKey: today, count: 1 });
      newCount = 1;
    } else {
      entry.count += 1;
      newCount = entry.count;
    }
    // Best-effort async DB sync for distributed consistency (fire-and-forget, fail-open)
    void import("@/lib/daily-quota-store")
      .then((m) => m.incrementDailyAsync(`${model}::${apiKey}`).catch(() => {}))
      .catch(() => {});
    return newCount;
  } catch (err) {
    console.warn(`[scheduler-state] incrementDailyForKey failed for ${model}, fail-open:`, err);
    return 0;
  }
}

/** Alias — consumes one RPD unit proactively. */
export function consumeDailyForKey(model: string, apiKey: string): number {
  return incrementDailyForKey(model, apiKey);
}

/** Checks if a model::key has proactive daily capacity (count < RPD). Fail-open. */
export function hasDailyCapacityForKey(model: string, apiKey: string): boolean {
  try {
    if (isKeyRpdExhausted(model, apiKey)) return false; // reactive already exhausted
    const rpd = getRpdForModel(model);
    if (!Number.isFinite(rpd)) return true;
    return getDailyCountForKey(model, apiKey) < rpd;
  } catch (err) {
    console.warn(`[scheduler-state] hasDailyCapacityForKey failed for ${model}, fail-open:`, err);
    return true;
  }
}

/** Checks if a model has any key with daily capacity (proactive + reactive). Fail-open. */
export function hasDailyCapacityForModel(model: string): boolean {
  try {
    const pool = getGeminiKeyPool().keys;
    for (const key of pool) {
      if (hasDailyCapacityForKey(model, key)) return true;
    }
    return false;
  } catch (err) {
    console.warn(`[scheduler-state] hasDailyCapacityForModel failed for ${model}, fail-open:`, err);
    return true;
  }
}

/** Async DB-aware daily capacity check for a model::key (distributed). Fail-open. */
export async function hasDailyCapacityForKeyAsync(model: string, apiKey: string): Promise<boolean> {
  try {
    if (isKeyRpdExhausted(model, apiKey)) return false;
    const rpd = getRpdForModel(model);
    if (!Number.isFinite(rpd)) return true;
    const { getDailyCountAsync } = await import("@/lib/daily-quota-store");
    const count = await getDailyCountAsync(`${model}::${apiKey}`);
    return count < rpd;
  } catch (err) {
    console.warn(`[scheduler-state] hasDailyCapacityForKeyAsync failed for ${model}, fail-open:`, err);
    return true;
  }
}

/** Resets proactive daily counters (test helper). */
export function resetDailyKeyCounts(): void {
  dailyKeyCounts.clear();
}

/** Checks if a specific key is currently in temporary RPM cooldown for the given model. */
export function isKeyRpmCoolingDown(model: string, apiKey: string): boolean {
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
export function markKeyRpmCoolingDown(
  model: string,
  apiKey: string,
  durationMs = DEFAULT_RPM_COOLDOWN_MS,
): void {
  const cacheKey = `${model}::${apiKey}`;
  rpmCooldownKeys.set(cacheKey, Date.now() + durationMs);
}

/**
 * Returns remaining cooldown duration in milliseconds for an API key on a given model.
 * Returns 0 if key is not currently in RPM cooldown.
 */
export function getKeyRpmCooldownRemainingMs(
  model: string,
  apiKey: string,
): number {
  const cacheKey = `${model}::${apiKey}`;
  const expiresAt = rpmCooldownKeys.get(cacheKey);
  if (!expiresAt) return 0;
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) {
    rpmCooldownKeys.delete(cacheKey);
    return 0;
  }
  return remaining;
}

/** Records a successful LLM call on the specified key for load balancing. */
export function recordKeyUsage(apiKey: string): void {
  keyUsageCounts.set(apiKey, (keyUsageCounts.get(apiKey) ?? 0) + 1);
}

/** Returns the total call count recorded for a given key. */
export function getKeyUsageCount(apiKey: string): number {
  return keyUsageCounts.get(apiKey) ?? 0;
}

/** Advances the round-robin counter and returns the offset for a collection length. */
export function getNextRoundRobinOffset(length: number): number {
  if (length <= 0) return 0;
  return roundRobinCounter++ % length;
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
  keyInFlightCounts.clear();
  dailyKeyCounts.clear();
  roundRobinCounter = 0;
}
