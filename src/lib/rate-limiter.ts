/**
 * Service-based isolated queues for API rate-limit management:
 * gap-enforced queue (e.g. OpenAlex 1 req/s) and concurrency limiter (e.g. Crossref max 3).
 */

export interface GapEnforcedQueue<T> {
  /** Runs tasks one-at-a-time with a minimum gap (ms) between completions. */
  exec(fn: () => Promise<T>): Promise<T>;
  size: number;
  waitForIdle(): Promise<void>;
}

/**
 * Creates a queue that runs at most one task at a time with a minimum gap (ms) between completions.
 *
 * @param minGapMs - The minimum delay between task completions.
 * @returns The gap-enforced queue instance.
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

  /**
   * Processes all pending tasks sequentially, enforcing the minimum completion gap.
   */
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
    /**
     * Runs a task in the queue, waiting for the minimum gap to elapse.
     *
     * @param fn - The task to run.
     * @returns A promise resolving to the task's result.
     */
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

    /**
     * Resolves once all currently queued tasks have completed.
     */
    async waitForIdle(): Promise<void> {
      await running;
    },
  };
}

export interface ConcurrencyLimiter {
  /** Runs fn with at most `concurrency` tasks in-flight. */
  exec<T>(fn: () => Promise<T>): Promise<T>;
  size: number;
  waitForIdle(): Promise<void>;
}

/**
 * Creates a promise-based semaphore capping the number of concurrently executing tasks.
 *
 * @param concurrency - The maximum number of tasks allowed to run concurrently.
 * @returns The concurrency limiter instance.
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

  /**
   * Dispatches queued tasks while the concurrency budget allows.
   */
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
    /**
     * Runs a task when a concurrency slot becomes available.
     *
     * @param fn - The task to run.
     * @returns A promise resolving to the task's result.
     */
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

    /**
     * Resolves once all currently running and queued tasks have completed.
     */
    async waitForIdle(): Promise<void> {
      await running;
    },
  };
}
