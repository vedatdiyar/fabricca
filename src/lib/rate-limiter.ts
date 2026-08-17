/**
 * Service-based rate limiting — a single unified motor.
 *
 * `createRateLimiter` provides a per-minute token bucket that allows bursts up
 * to the configured ceiling, an optional per-day cap that resets at Pacific
 * midnight, and an optional concurrency cap used ONLY when a provider documents
 * one. Quota exhaustion never overflows a provider limit — RPM waits in line,
 * RPD raises `DailyQuotaExceededError` so callers decide (stop, fall back, or
 * surface the outcome).
 */

/** Day key for a given timezone-aware instant (formatted for Pacific midnight resets). */
export function getPacificDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Thrown when a limiter's per-day quota is exhausted (RPM waits instead). */
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

/** Per-day counter that resets whenever the Pacific date key changes. */
class DailyCounter {
  private dayKey = "";
  private used = 0;

  constructor(private readonly cap: number) {}

  tryTake(): boolean {
    const key = getPacificDateKey();
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.used = 0;
    }
    if (this.used >= this.cap) return false;
    this.used += 1;
    return true;
  }

  /** True while the Pacific-daily cap still has unused capacity. */
  hasCapacity(): boolean {
    const key = getPacificDateKey();
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.used = 0;
    }
    return this.used < this.cap;
  }
}

/** Counting semaphore for provider-documented in-flight caps. */
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
  /** Logical name used in `DailyQuotaExceededError` messages and logs. */
  label: string;
  /** Per-minute token-bucket ceiling (wait, never overflow). */
  rpm?: number;
  /** Per-day cap (throws `DailyQuotaExceededError` when exhausted). */
  rpd?: number;
  /** In-flight cap — set ONLY when a provider documents a concurrency limit. */
  concurrency?: number;
}

export interface RateLimiter {
  /** Runs `fn` once capacity is available, without ever violating a quota. */
  exec<T>(fn: () => Promise<T>): Promise<T>;
  /** True while the per-day cap is not exhausted (or no daily cap is set). */
  hasDailyCapacity(): boolean;
  /** Number of tasks currently in flight (running + waiting on the semaphore). */
  size: number;
  /** Resolves once every currently in-flight task has settled. */
  waitForIdle(): Promise<void>;
}

/**
 * Creates the unified quota limiter:
 * - RPM: tasks wait in FIFO order for bucket tokens; bursts up to `rpm` run at once.
 * - RPD: tasks throw `DailyQuotaExceededError` once the Pacific daily cap is spent.
 * - concurrency: extra cap on simultaneous tasks (provider-documented only).
 *
 * @param options - The limiter's label and optional rpm/rpd/concurrency caps.
 * @returns The `RateLimiter` instance.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const bucket =
    options.rpm && options.rpm > 0 ? new TokenBucket(options.rpm) : null;
  const daily =
    options.rpd && options.rpd > 0 ? new DailyCounter(options.rpd) : null;
  const semaphore =
    options.concurrency && options.concurrency > 0
      ? new Semaphore(options.concurrency)
      : null;

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

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (daily && !daily.tryTake()) {
      throw new DailyQuotaExceededError(options.label);
    }
    await waitForToken();
    const release = semaphore ? await semaphore.acquire() : null;
    try {
      return await fn();
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
      return daily ? daily.hasCapacity() : true;
    },
    waitForIdle(): Promise<void> {
      return Promise.allSettled([...inFlight]).then(() => undefined);
    },
  };
}
