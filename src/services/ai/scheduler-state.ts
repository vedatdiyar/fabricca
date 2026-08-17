import { getPacificDateKey } from "@/lib/rate-limiter";
import { getGeminiKeyPool } from "./gemini-key-pool";

/** Keys that exhausted their daily quota (RPD), mapped `${model}::${apiKey}` → Pacific date key. */
const rpdExhaustedKeys = new Map<string, string>();

/** Keys in temporary RPM cooldown, mapped `${model}::${apiKey}` → timestamp when cooldown expires (ms). */
const rpmCooldownKeys = new Map<string, number>();

/** Total successful call count per API key string, used for least-used balancing. */
const keyUsageCounts = new Map<string, number>();

/** Round-robin sequence cursor for fair tie-breaking. */
let roundRobinCounter = 0;

/** Default cooldown duration for RPM rate limits (60 seconds). */
export const DEFAULT_RPM_COOLDOWN_MS = 60_000;

/** Checks if a specific key has hit RPD exhaustion for the given model today. */
export function isKeyRpdExhausted(model: string, apiKey: string): boolean {
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
export function markKeyRpdExhausted(model: string, apiKey: string): void {
  const cacheKey = `${model}::${apiKey}`;
  rpdExhaustedKeys.set(cacheKey, getPacificDateKey());
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
  roundRobinCounter = 0;
}
