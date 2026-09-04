/**
 * Service-based rate limiting — unified motor.
 *
 * `createRateLimiter` provides:
 * - RPM: per-minute token bucket that paces tasks to respect configured RPM limits.
 * - Concurrency: counting semaphore when a concurrency limit is specified.
 * No arbitrary daily quota cuts or unrequested stopping mechanisms.
 */

import { getPacificDateKey } from "./pacific-ttl";
export { getPacificDateKey };

// ── Daily RPD counters (Pacific date-key, per label) — in-memory with Redis fail-open ──
/** In-memory daily counters keyed by `label`. Each entry tracks Pacific date and count. */
const dailyCounters = new Map<string, { dateKey: string; count: number }>();

/** Returns the current daily count for a label (0 if none or date rolled). Fail-open on error. */
export function getDailyCount(label: string): number {
  try {
    const today = getPacificDateKey();
    const entry = dailyCounters.get(label);
    if (!entry || entry.dateKey !== today) return 0;
    return entry.count;
  } catch (err) {
    console.warn(`[rate-limiter] getDailyCount failed for ${label}, fail-open:`, err);
    return 0;
  }
}

/** Atomically increments the daily counter for a label and returns the new count. Fail-open. */
export function incrementDaily(label: string): number {
  try {
    const today = getPacificDateKey();
    const entry = dailyCounters.get(label);
    if (!entry || entry.dateKey !== today) {
      dailyCounters.set(label, { dateKey: today, count: 1 });
      // Best-effort async Redis sync for distributed consistency (fire-and-forget, fail-open, Pacific TTL)
      void import("./redis-quota")
        .then((m) => m.incrementDailyAsync(label).catch(() => {}))
        .catch(() => {});
      return 1;
    }
    entry.count += 1;
    void import("./redis-quota")
      .then((m) => m.incrementDailyAsync(label).catch(() => {}))
      .catch(() => {});
    return entry.count;
  } catch (err) {
    console.warn(`[rate-limiter] incrementDaily failed for ${label}, fail-open:`, err);
    return 0;
  }
}

/** Alias for incrementDaily — consumes one unit of daily quota. */
export function consumeDaily(label: string): number {
  return incrementDaily(label);
}

/** Checks if a label has daily capacity remaining (sync, in-memory, fail-open). */
export function hasDailyCapacityFor(label: string, rpd?: number): boolean {
  if (!rpd || rpd <= 0) return true;
  try {
    return getDailyCount(label) < rpd;
  } catch (err) {
    console.warn(`[rate-limiter] hasDailyCapacityFor failed for ${label}, fail-open:`, err);
    return true;
  }
}

/** Async Redis-aware daily capacity check (distributed). Fail-open on Redis error. */
export async function hasDailyCapacityForAsync(label: string, rpd?: number): Promise<boolean> {
  if (!rpd || rpd <= 0) return true;
  try {
    const { hasDailyCapacityAsync } = await import("./redis-quota");
    return await hasDailyCapacityAsync(label, rpd);
  } catch (err) {
    console.warn(`[rate-limiter] hasDailyCapacityForAsync failed for ${label}, fail-open:`, err);
    return true;
  }
}

/** Resets all daily counters (test helper). */
export function resetDailyCounters(): void {
  dailyCounters.clear();
}

/** Thrown when a limiter's per-day quota is exhausted (kept for type compatibility). */
export class DailyQuotaExceededError extends Error {
  readonly label: string;

  constructor(label: string) {
    super(`Daily quota exhausted for "${label}".`);
    this.name = "DailyQuotaExceededError";
    this.label = label;
  }
}

/** Narrower type guard for `DailyQuotaExceededError`. */
export function isDailyQuotaExceeded(error: unknown): boolean {
  return error instanceof DailyQuotaExceededError;
}

/** Per-minute token bucket: refills continuously, allows bursts up to capacity. */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(private readonly capacity: number) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + (elapsed / 60_000) * this.capacity,
    );
    this.lastRefill = now;
  }

  tryTake(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  msUntilNextToken(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return Math.max(1, Math.ceil(((1 - this.tokens) / this.capacity) * 60_000));
  }
}

/** Counting semaphore for in-flight concurrency caps. */
class Semaphore {
  private active = 0;
  private waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const enter = () => {
        this.active += 1;
        resolve(this.release());
      };
      if (this.active < this.max) {
        enter();
      } else {
        this.waiters.push(enter);
      }
    });
  }

  private release(): () => void {
    return () => {
      this.active -= 1;
      const next = this.waiters.shift();
      if (next) next();
    };
  }
}

export interface RateLimiterOptions {
  /** Logical name used in logs. */
  label: string;
  /** Per-minute token-bucket ceiling. */
  rpm?: number;
  /** Per-day cap (optional). */
  rpd?: number;
  /** In-flight concurrency cap (optional). */
  concurrency?: number;
  /** Minimum gap between the *start* of two executions (ms). Turnstile pacing. */
  minIntervalMs?: number;
}

export interface RateLimiter {
  /** Runs `fn` once token and concurrency capacity are available. */
  exec<T>(fn: () => Promise<T>): Promise<T>;
  /** True while the limiter has capacity (sync, in-memory, fail-open). */
  hasDailyCapacity(): boolean;
  /** Async DB-aware daily capacity check (distributed). Fail-open on DB error. */
  hasDailyCapacityAsync(): Promise<boolean>;
  /** Returns current daily count for this limiter's label. */
  getDailyCount(): number;
  /** Increments daily counter for this limiter's label (call after success). */
  incrementDaily(): number;
  /** Number of tasks currently in flight. */
  size: number;
  /** Resolves once every currently in-flight task has settled. */
  waitForIdle(): Promise<void>;
}

/**
 * Creates a rate limiter honoring the configured RPM and concurrency.
 *
 * @param options - Limiter options (label, rpm, concurrency).
 * @returns The RateLimiter instance.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const bucket =
    options.rpm && options.rpm > 0 ? new TokenBucket(options.rpm) : null;
  const semaphore =
    options.concurrency && options.concurrency > 0
      ? new Semaphore(options.concurrency)
      : null;
  const minIntervalMs = options.minIntervalMs ?? 0;
  let lastStartMs = 0;
  let intervalChain: Promise<void> = Promise.resolve();

  const inFlight = new Set<Promise<unknown>>();
  const tokenWaiters: Array<() => void> = [];
  let refillTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleRefill(): void {
    if (refillTimer || !bucket) return;
    const delayMs = bucket.msUntilNextToken();
    refillTimer = setTimeout(() => {
      refillTimer = null;
      while (tokenWaiters.length > 0 && bucket.tryTake()) {
        tokenWaiters.shift()!();
      }
      if (tokenWaiters.length > 0) scheduleRefill();
    }, delayMs);
  }

  function waitForToken(): Promise<void> {
    if (!bucket || bucket.tryTake()) return Promise.resolve();
    scheduleRefill();
    return new Promise<void>((resolve) => tokenWaiters.push(resolve));
  }

  function waitForMinInterval(): Promise<void> {
    if (minIntervalMs <= 0) return Promise.resolve();
    const task = intervalChain.then(async () => {
      const now = Date.now();
      const elapsed = now - lastStartMs;
      const waitMs = minIntervalMs - elapsed;
      if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
      lastStartMs = Date.now();
    });
    // Chain next waiter behind this one (ignore errors)
    intervalChain = task.catch(() => {});
    return task;
  }

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    // Proactive RPD gate — fail fast if daily quota exhausted (sync, fail-open)
    if (options.rpd && options.rpd > 0 && !hasDailyCapacityFor(options.label, options.rpd)) {
      throw new DailyQuotaExceededError(options.label);
    }
    await waitForToken();
    await waitForMinInterval();
    const release = semaphore ? await semaphore.acquire() : null;
    try {
      const result = await fn();
      // Successful execution consumes one daily quota unit (if RPD is configured)
      if (options.rpd && options.rpd > 0) {
        try {
          incrementDaily(options.label);
        } catch (err) {
          console.warn(`[rate-limiter:${options.label}] incrementDaily after success failed, fail-open:`, err);
        }
      }
      return result;
    } finally {
      release?.();
    }
  }

  return {
    exec<T>(fn: () => Promise<T>): Promise<T> {
      const task = run(fn);
      inFlight.add(task);
      task
        .finally(() => {
          inFlight.delete(task);
        })
        .catch(() => {});
      return task;
    },
    get size(): number {
      return inFlight.size;
    },
    hasDailyCapacity(): boolean {
      try {
        if (!options.rpd || options.rpd <= 0) return true;
        return hasDailyCapacityFor(options.label, options.rpd);
      } catch (err) {
        console.warn(`[rate-limiter:${options.label}] hasDailyCapacity failed, fail-open:`, err);
        return true;
      }
    },
    async hasDailyCapacityAsync(): Promise<boolean> {
      try {
        if (!options.rpd || options.rpd <= 0) return true;
        return await hasDailyCapacityForAsync(options.label, options.rpd);
      } catch (err) {
        console.warn(`[rate-limiter:${options.label}] hasDailyCapacityAsync failed, fail-open:`, err);
        return true;
      }
    },
    getDailyCount(): number {
      try {
        return getDailyCount(options.label);
      } catch (err) {
        console.warn(`[rate-limiter:${options.label}] getDailyCount failed, fail-open:`, err);
        return 0;
      }
    },
    incrementDaily(): number {
      try {
        return incrementDaily(options.label);
      } catch (err) {
        console.warn(`[rate-limiter:${options.label}] incrementDaily failed, fail-open:`, err);
        return 0;
      }
    },
    waitForIdle(): Promise<void> {
      return Promise.allSettled([...inFlight]).then(() => undefined);
    },
  };
}
