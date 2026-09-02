/**
 * Distributed daily quota store — DB-backed with in-memory fallback.
 *
 * - Primary: Neon Postgres `daily_quota_counters` (service_key, date_key in America/Los_Angeles, request_count).
 * - Fallback: process-memory Map if DATABASE_URL missing or DB errors (fail-open with warning).
 *
 * This store is used by both the generic RateLimiter (label-based) and the Gemini
 * scheduler (model::key-based) to make RPD limits consistent across devices / serverless instances.
 */
import { getPacificDateKey } from "./rate-limiter";

// In-memory fallback (per-process). Keys are `serviceKey::dateKey` or just serviceKey with dateKey check.
const memoryFallback = new Map<string, { dateKey: string; count: number }>();

let tableEnsured = false;

/**
 * Ensures the `daily_quota_counters` table exists. No-op if already ensured or if DB is unavailable.
 * Uses raw SQL `CREATE TABLE IF NOT EXISTS` so no manual migration is required for this ultra-light table.
 */
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    // Lazy import to avoid loading `server-only` db in edge/client contexts
    const { db } = await import("@/core/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS daily_quota_counters (
        id SERIAL PRIMARY KEY,
        service_key VARCHAR(128) NOT NULL,
        date_key VARCHAR(10) NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(service_key, date_key)
      )
    `);
    // Ensure indexes exist (idempotent)
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_quota_service_date ON daily_quota_counters(service_key, date_key)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_daily_quota_service_key ON daily_quota_counters(service_key)`);
    tableEnsured = true;
  } catch (err) {
    // Fail-open: will use memory fallback. Log once.
    console.warn("[daily-quota-store] ensureTable failed, using memory fallback:", err);
  }
}

/**
 * Returns the current daily count for a service key (Pacific date).
 * Tries DB first, falls back to memory on error.
 *
 * @param serviceKey - Logical quota key (e.g. "gemini_gemini-2.0-flash::key_1" or "cohere").
 * @returns The current request count for today (0 if none).
 */
export async function getDailyCountAsync(serviceKey: string): Promise<number> {
  const dateKey = getPacificDateKey();
  try {
    await ensureTable();
    const { db } = await import("@/core/db");
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(sql`
      SELECT request_count FROM daily_quota_counters
      WHERE service_key = ${serviceKey} AND date_key = ${dateKey}
      LIMIT 1
    `);
    const rows = (result as unknown as { rows?: Array<{ request_count: number }> }).rows ?? [];
    if (rows.length > 0 && typeof rows[0].request_count === "number") {
      // Sync memory fallback for fast sync reads
      memoryFallback.set(serviceKey, { dateKey, count: rows[0].request_count });
      return rows[0].request_count;
    }
    return 0;
  } catch (err) {
    console.warn(`[daily-quota-store] getDailyCountAsync failed for ${serviceKey}, fail-open with memory:`, err);
    const entry = memoryFallback.get(serviceKey);
    if (!entry || entry.dateKey !== dateKey) return 0;
    return entry.count;
  }
}

/**
 * Atomically increments the daily counter for a service key and returns the new count.
 * Uses `INSERT ... ON CONFLICT DO UPDATE` for atomicity across concurrent serverless instances.
 * Falls back to in-memory increment on DB error (fail-open).
 *
 * @param serviceKey - Logical quota key.
 * @returns The new request count after increment.
 */
export async function incrementDailyAsync(serviceKey: string): Promise<number> {
  const dateKey = getPacificDateKey();
  try {
    await ensureTable();
    const { db } = await import("@/core/db");
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(sql`
      INSERT INTO daily_quota_counters (service_key, date_key, request_count)
      VALUES (${serviceKey}, ${dateKey}, 1)
      ON CONFLICT (service_key, date_key)
      DO UPDATE SET request_count = daily_quota_counters.request_count + 1, updated_at = NOW()
      RETURNING request_count
    `);
    const rows = (result as unknown as { rows?: Array<{ request_count: number }> }).rows ?? [];
    const newCount = rows.length > 0 ? Number(rows[0].request_count) : 1;
    memoryFallback.set(serviceKey, { dateKey, count: newCount });
    return newCount;
  } catch (err) {
    console.warn(`[daily-quota-store] incrementDailyAsync failed for ${serviceKey}, using memory fallback:`, err);
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
 * Checks if a service key has daily capacity remaining (async, DB-aware).
 * Fail-open: on DB error returns true so the external provider's own 429 can be caught by Aşama 1-2 armor.
 *
 * @param serviceKey - Logical quota key.
 * @param rpd - Requests-per-day limit (per key, per model).
 * @returns True if count < rpd, false if exhausted.
 */
export async function hasDailyCapacityAsync(serviceKey: string, rpd: number): Promise<boolean> {
  if (!rpd || rpd <= 0) return true;
  try {
    const count = await getDailyCountAsync(serviceKey);
    return count < rpd;
  } catch (err) {
    console.warn(`[daily-quota-store] hasDailyCapacityAsync failed for ${serviceKey}, fail-open:`, err);
    return true;
  }
}

// ── Synchronous in-memory helpers (for hasDailyCapacity() sync path) ──

export function getDailyCountSync(serviceKey: string): number {
  try {
    const dateKey = getPacificDateKey();
    const entry = memoryFallback.get(serviceKey);
    if (!entry || entry.dateKey !== dateKey) return 0;
    return entry.count;
  } catch (err) {
    console.warn(`[daily-quota-store] getDailyCountSync failed for ${serviceKey}, fail-open:`, err);
    return 0;
  }
}

export function incrementDailySync(serviceKey: string): number {
  try {
    const dateKey = getPacificDateKey();
    const entry = memoryFallback.get(serviceKey);
    if (!entry || entry.dateKey !== dateKey) {
      memoryFallback.set(serviceKey, { dateKey, count: 1 });
      // Fire-and-forget async DB increment for distributed sync (best-effort)
      void incrementDailyAsync(serviceKey).catch(() => {});
      return 1;
    }
    entry.count += 1;
    void incrementDailyAsync(serviceKey).catch(() => {});
    return entry.count;
  } catch (err) {
    console.warn(`[daily-quota-store] incrementDailySync failed for ${serviceKey}, fail-open:`, err);
    return 0;
  }
}

export function hasDailyCapacitySync(serviceKey: string, rpd: number): boolean {
  if (!rpd || rpd <= 0) return true;
  try {
    return getDailyCountSync(serviceKey) < rpd;
  } catch (err) {
    console.warn(`[daily-quota-store] hasDailyCapacitySync failed for ${serviceKey}, fail-open:`, err);
    return true;
  }
}

/** For tests: reset the in-memory fallback. */
export function resetDailyQuotaStore(): void {
  memoryFallback.clear();
  tableEnsured = false;
}
