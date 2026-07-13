/**
 * rate-limiter.ts
 *
 * Service-based isolated queues for API rate-limit management.
 *
 * Two primitives:
 *   1. `createGapEnforcedQueue` — ensures a minimum wall-clock gap (ms)
 *      between successive task completions. Used for OpenAlex (1 req/s).
 *   2. `createConcurrencyLimiter` — caps the number of in-flight tasks.
 *      Used for Crossref enrichment (max 3 concurrent).
 *
 * Both are promise-based, re-entrant-safe singletons.
 */

// ============================================================================
// Gap-enforced queue (strict serialization + min gap between completions)
// ============================================================================

export interface GapEnforcedQueue<T> {
  /** Enqueue a task; returns its result. Tasks run one-at-a-time with minGap. */
  exec(fn: () => Promise<T>): Promise<T>;
  /** Number of tasks waiting or in-flight. */
  size: number;
  /** Resolves when the queue is empty and the last task has finished its gap. */
  waitForIdle(): Promise<void>;
}

/**
 * Creates a queue that runs at most one task at a time and enforces a minimum
 * gap (ms) between the completion of one task and the start of the next.
 *
 * Retries are considered part of the same logical task — the gap only applies
 * *after* the task resolves (success or final failure).
 */
export function createGapEnforcedQueue<T>(
  minGapMs: number,
): GapEnforcedQueue<T> {
  let lastCompletion = 0;
  let running: Promise<unknown> | null = null;
  const pending: Array<{
    fn: () => Promise<T>;
    resolve: (v: T) => void;
    reject: (e: unknown) => void;
  }> = [];

  async function drain(): Promise<void> {
    while (pending.length > 0) {
      const elapsed = Date.now() - lastCompletion;
      if (elapsed < minGapMs) {
        await new Promise((r) => setTimeout(r, minGapMs - elapsed));
      }
      const item = pending.shift()!;
      try {
        const result = await item.fn();
        lastCompletion = Date.now();
        item.resolve(result);
      } catch (err) {
        lastCompletion = Date.now();
        item.reject(err);
      }
    }
    running = null;
  }

  return {
    exec(fn: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        pending.push({ fn, resolve, reject });
        if (!running) {
          running = drain();
        }
      });
    },

    get size(): number {
      return pending.length;
    },

    async waitForIdle(): Promise<void> {
      await running;
    },
  };
}

// ============================================================================
// Concurrency-limited executor (max N in-flight, no gap enforcement)
// ============================================================================

export interface ConcurrencyLimiter {
  /** Run fn with the guarantee that ≤ concurrency tasks are in-flight. */
  exec<T>(fn: () => Promise<T>): Promise<T>;
  /** Number of tasks waiting or in-flight. */
  size: number;
  /** Resolves when all tasks are done. */
  waitForIdle(): Promise<void>;
}

/**
 * Creates a simple promise-based semaphore that caps the number of
 * concurrently executing tasks at `concurrency`. No gap enforcement.
 */
export function createConcurrencyLimiter(
  concurrency: number,
): ConcurrencyLimiter {
  let active = 0;
  let running: Promise<unknown> | null = null;
  const pending: Array<{
    fn: () => Promise<unknown>;
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
  }> = [];

  async function drain(): Promise<void> {
    while (pending.length > 0 && active < concurrency) {
      const item = pending.shift()!;
      active++;
      item
        .fn()
        .then(item.resolve, item.reject)
        .finally(() => {
          active--;
          if (pending.length > 0 && active < concurrency) {
            running = drain();
          } else if (pending.length === 0 && active === 0) {
            running = null;
          }
        });
    }
  }

  return {
    exec<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        pending.push({
          fn: fn as () => Promise<unknown>,
          resolve: resolve as (v: unknown) => void,
          reject: reject as (e: unknown) => void,
        });
        if (!running || active < concurrency) {
          running = drain();
        }
      }) as Promise<T>;
    },

    get size(): number {
      return pending.length + active;
    },

    async waitForIdle(): Promise<void> {
      await running;
    },
  };
}
