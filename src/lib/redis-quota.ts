/**
 * Upstash Redis quota store — distributed RPD ledger (Pacific date-key, atomic Lua).
 *
 * - Primary: Upstash Redis REST (HTTP, edge/serverless compatible, atomic EVAL).
 * - Fallback: in-memory Map when UPSTASH env missing or Redis errors (fail-open).
 * - TTL: auto-expire at next Pacific midnight (PEXPIRE), no cron needed.
 * - Key format: rpd:{model}:{hash8}:{dateKey} or rpd:{serviceKey}:{dateKey} (hashed apiKey part).
 *
 * Zero-config: if UPSTASH_REDIS_REST_URL/TOKEN missing (local/CI), silently uses memory.
 */
import { getPacificDateKey, msUntilNextPacificMidnight } from "./pacific-ttl";

// ── Redis client (lazy, zero-config) ──
import type { Redis as UpstashRedisType } from "@upstash/redis";

let redisClient: UpstashRedisType | null | undefined = undefined;
let warnedMissingEnv = false;

function getRedis(): UpstashRedisType | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!warnedMissingEnv) {
      warnedMissingEnv = true;
      console.warn("[redis-quota] UPSTASH env missing — using in-memory fallback (local/CI).");
    }
    redisClient = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
    redisClient = new Redis({ url, token, enableTelemetry: false });
    return redisClient;
  } catch (err) {
    console.warn("[redis-quota] Redis init failed, using memory fallback:", err);
    redisClient = null;
    return null;
  }
}

/** Whether Redis is configured and available. */
export function isRedisEnabled(): boolean {
  return getRedis() !== null;
}

// ── Helpers ──
function hashKeyPart(raw: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHash } = require("crypto") as typeof import("crypto");
    return createHash("sha256").update(raw).digest("hex").slice(0, 8);
  } catch {
    return raw.slice(-8);
  }
}

function buildRedisKey(serviceKey: string, dateKey: string): string {
  // serviceKey may be "model::apiKey" — hash the apiKey part for privacy
  const sepIndex = serviceKey.indexOf("::");
  if (sepIndex !== -1) {
    const model = serviceKey.slice(0, sepIndex);
    const apiKey = serviceKey.slice(sepIndex + 2);
    const hash = hashKeyPart(apiKey);
    return `rpd:${model}:${hash}:${dateKey}`;
  }
  // Generic label (e.g. "cohere", "openalex") — no hashing needed
  const safe = serviceKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return `rpd:${safe}:${dateKey}`;
}

// In-memory fallback (fail-open) — mirrors Redis shape
const memoryFallback = new Map<string, { dateKey: string; count: number }>();

// Atomic Lua: check limit, increment, set PEXPIRE on first write
const INCR_WITH_LIMIT_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
local ttlMs = tonumber(ARGV[2])
if current >= limit then
  return current
end
local newCount = redis.call('INCR', KEYS[1])
if current == 0 then
  redis.call('PEXPIRE', KEYS[1], ttlMs)
end
return newCount
`;

/**
 * Returns current daily count for a service key (Pacific date).
 * Tries Redis, falls back to memory on error/missing env.
 */
export async function getDailyCountAsync(serviceKey: string): Promise<number> {
  const dateKey = getPacificDateKey();
  const redis = getRedis();
  if (!redis) {
    const entry = memoryFallback.get(serviceKey);
    if (!entry || entry.dateKey !== dateKey) return 0;
    return entry.count;
  }
  try {
    const redisKey = buildRedisKey(serviceKey, dateKey);
    const raw = await redis.get<number | string>(redisKey);
    if (raw === null || raw === undefined) return 0;
    const count = typeof raw === "string" ? Number(raw) : Number(raw);
    if (!Number.isFinite(count)) return 0;
    memoryFallback.set(serviceKey, { dateKey, count });
    return count;
  } catch (err) {
    console.warn(`[redis-quota] getDailyCountAsync failed for ${serviceKey}, fail-open with memory:`, err);
    const entry = memoryFallback.get(serviceKey);
    if (!entry || entry.dateKey !== dateKey) return 0;
    return entry.count;
  }
}

/**
 * Atomically increments daily counter if under limit, with Pacific TTL.
 * Returns new count (or current count if already at/over limit — does not increment past limit).
 * Fail-open: on Redis error, increments memory fallback.
 */
export async function incrementDailyAsync(serviceKey: string, rpdLimit?: number): Promise<number> {
  const dateKey = getPacificDateKey();
  const redis = getRedis();
  const ttlMs = msUntilNextPacificMidnight();

  // If no Redis, in-memory increment with limit enforcement (atomic in-process)
  if (!redis) {
    const entry = memoryFallback.get(serviceKey);
    if (!entry || entry.dateKey !== dateKey) {
      memoryFallback.set(serviceKey, { dateKey, count: 1 });
      return 1;
    }
    if (rpdLimit !== undefined && rpdLimit > 0 && Number.isFinite(rpdLimit) && entry.count >= rpdLimit) {
      return entry.count;
    }
    entry.count += 1;
    return entry.count;
  }

  try {
    const redisKey = buildRedisKey(serviceKey, dateKey);
    // If rpdLimit provided, use atomic limit check; otherwise plain INCR+PEXPIRE
    if (rpdLimit !== undefined && rpdLimit > 0 && Number.isFinite(rpdLimit)) {
      const result = (await redis.eval(INCR_WITH_LIMIT_SCRIPT, [redisKey], [String(rpdLimit), String(ttlMs)])) as number;
      const count = Number(result);
      memoryFallback.set(serviceKey, { dateKey, count });
      return count;
    }
    // No limit — simple INCR path
    const current = await redis.get<number | string>(redisKey);
    if (current === null || current === undefined) {
      await redis.set(redisKey, 1, { px: ttlMs });
      memoryFallback.set(serviceKey, { dateKey, count: 1 });
      return 1;
    }
    const newCount = (await redis.incr(redisKey)) as number;
    memoryFallback.set(serviceKey, { dateKey, count: Number(newCount) });
    return Number(newCount);
  } catch (err) {
    console.warn(`[redis-quota] incrementDailyAsync failed for ${serviceKey}, using memory fallback:`, err);
    const entry = memoryFallback.get(serviceKey);
    if (!entry || entry.dateKey !== dateKey) {
      memoryFallback.set(serviceKey, { dateKey, count: 1 });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }
}

/**
 * Checks if service key has capacity (count < rpd). Fail-open.
 */
export async function hasDailyCapacityAsync(serviceKey: string, rpd: number): Promise<boolean> {
  if (!rpd || rpd <= 0) return true;
  try {
    const count = await getDailyCountAsync(serviceKey);
    return count < rpd;
  } catch (err) {
    console.warn(`[redis-quota] hasDailyCapacityAsync failed for ${serviceKey}, fail-open:`, err);
    return true;
  }
}

// ── Synchronous in-memory helpers (for sync candidate-selector path) ──
export function getDailyCountSync(serviceKey: string): number {
  try {
    const dateKey = getPacificDateKey();
    const entry = memoryFallback.get(serviceKey);
    if (!entry || entry.dateKey !== dateKey) return 0;
    return entry.count;
  } catch (err) {
    console.warn(`[redis-quota] getDailyCountSync failed for ${serviceKey}, fail-open:`, err);
    return 0;
  }
}

export function incrementDailySync(serviceKey: string): number {
  try {
    const dateKey = getPacificDateKey();
    const entry = memoryFallback.get(serviceKey);
    if (!entry || entry.dateKey !== dateKey) {
      memoryFallback.set(serviceKey, { dateKey, count: 1 });
      // Best-effort async Redis sync (fire-and-forget, TTL handled there)
      void incrementDailyAsync(serviceKey).catch(() => {});
      return 1;
    }
    entry.count += 1;
    void incrementDailyAsync(serviceKey).catch(() => {});
    return entry.count;
  } catch (err) {
    console.warn(`[redis-quota] incrementDailySync failed for ${serviceKey}, fail-open:`, err);
    return 0;
  }
}

export function hasDailyCapacitySync(serviceKey: string, rpd: number): boolean {
  if (!rpd || rpd <= 0) return true;
  try {
    return getDailyCountSync(serviceKey) < rpd;
  } catch (err) {
    console.warn(`[redis-quota] hasDailyCapacitySync failed for ${serviceKey}, fail-open:`, err);
    return true;
  }
}

/** For tests: reset in-memory fallback and client. */
export function resetDailyQuotaStore(): void {
  memoryFallback.clear();
  // Do not clear redisClient — keep connection; env missing case already null
}

/** For tests/admin: clear all quota data for a service key today (Redis + memory). */
export async function clearDailyQuota(serviceKey: string): Promise<void> {
  const dateKey = getPacificDateKey();
  memoryFallback.delete(serviceKey);
  const redis = getRedis();
  if (!redis) return;
  try {
    const redisKey = buildRedisKey(serviceKey, dateKey);
    await redis.del(redisKey);
  } catch (err) {
    console.warn(`[redis-quota] clearDailyQuota failed for ${serviceKey}:`, err);
  }
}

/** Sync helper to saturate memory count to RPD (used when reactive 429 received). */
export function saturateDailyCountSync(serviceKey: string, rpd: number): void {
  const dateKey = getPacificDateKey();
  memoryFallback.set(serviceKey, { dateKey, count: rpd });
}

/** Async helper to saturate Redis count to RPD (fire-and-forget, sets key directly with TTL). */
export async function saturateDailyCountAsync(serviceKey: string, rpd: number): Promise<void> {
  const dateKey = getPacificDateKey();
  const redis = getRedis();
  if (!redis) {
    saturateDailyCountSync(serviceKey, rpd);
    return;
  }
  try {
    const redisKey = buildRedisKey(serviceKey, dateKey);
    const ttlMs = msUntilNextPacificMidnight();
    await redis.set(redisKey, rpd, { px: ttlMs });
    memoryFallback.set(serviceKey, { dateKey, count: rpd });
  } catch (err) {
    console.warn(`[redis-quota] saturateDailyCountAsync failed for ${serviceKey}:`, err);
    saturateDailyCountSync(serviceKey, rpd);
  }
}
