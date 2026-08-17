/**
 * Service-based rate limiting — unified motor.
 *
 * `createRateLimiter` provides:
 * - RPM: per-minute token bucket that paces tasks to respect configured RPM limits.
 * - Concurrency: counting semaphore when a concurrency limit is specified.
 * No arbitrary daily quota cuts or unrequested stopping mechanisms.
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
}

export interface RateLimiter {
  /** Runs `fn` once token and concurrency capacity are available. */
  exec<T>(fn: () => Promise<T>): Promise<T>;
  /** True while the limiter has capacity. */
  hasDailyCapacity(): boolean;
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
      return true;
    },
    waitForIdle(): Promise<void> {
      return Promise.allSettled([...inFlight]).then(() => undefined);
    },
  };
}


