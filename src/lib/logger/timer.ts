import type { LogParams, ScopedTimer } from "./types";

/**
 * Creates a scoped timer that logs success/failure with elapsed time.
 *
 * @param onSuccess - Callback on success.
 * @param onFailed - Callback on failure.
 * @param p - Log params to forward.
 * @returns Scoped timer.
 */
export function createScopedTimer(
  onSuccess: (durationMs: number, summary?: string, p?: LogParams) => void,
  onFailed: (
    durationMs: number,
    error: unknown,
    summary?: string,
    p?: LogParams,
  ) => void,
  p?: LogParams,
): ScopedTimer {
  const startedAt = performance.now();
  let finished = false;
  return {
    done: (summary?: string) => {
      if (finished) return;
      finished = true;
      const durationMs = Math.round(performance.now() - startedAt);
      const data = summary ? { ...p?.data, summary } : p?.data;
      onSuccess(durationMs, summary, p ? { ...p, data } : p);
      void summary;
    },
    fail: (error: unknown, summary?: string) => {
      if (finished) return;
      finished = true;
      const durationMs = Math.round(performance.now() - startedAt);
      const data = summary ? { ...p?.data, summary } : p?.data;
      onFailed(durationMs, error, summary, p ? { ...p, data } : p);
      void summary;
    },
  };
}

/**
 * Measures an async function and returns duration + result or re-throws.
 *
 * @param fn - Async function to measure.
 * @returns Duration and result or throws.
 */
export async function measureAsync<T>(
  fn: () => Promise<T>,
): Promise<{ durationMs: number; result: T }> {
  const startedAt = performance.now();
  const result = await fn();
  return { durationMs: Math.round(performance.now() - startedAt), result };
}
