/**
 * Coalesces high-frequency streaming delta callbacks into fixed-interval UI
 * state updates. Each scheduled callback replaces the previous pending one, so
 * React re-renders at most once per interval regardless of network chunk rate.
 *
 * @param intervalMs - Minimum delay between two flushes.
 * @returns A throttled scheduler bound to a single stream turn.
 */
export interface StreamFlusher {
  schedule(apply: () => void): void;
  flushNow(): void;
  cancel(): void;
}

export function createStreamFlusher(intervalMs = 50): StreamFlusher {
  let pending: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const apply = pending;
    pending = null;
    apply?.();
  };

  return {
    schedule(apply) {
      pending = apply;
      if (timer === null) {
        timer = setTimeout(flush, intervalMs);
      }
    },
    flushNow() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
    },
  };
}
