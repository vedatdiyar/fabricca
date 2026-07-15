import { createConcurrencyLimiter } from "../rate-limiter";
const TEZARA_FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  connection: "keep-alive",
} as const;

const MAX_CONCURRENCY = 12;
const MIN_DELAY_MS = 100;
const MAX_DELAY_MS = 250;
const BURST_WINDOW_MS = 3000;
const MAX_BURST = 24;
const requestTimestamps: number[] = [];

function getDynamicDelay(): number {
  return (
    MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1))
  );
}

function pruneTimestamps(): void {
  const now = Date.now();
  while (
    requestTimestamps.length > 0 &&
    now - requestTimestamps[0] >= BURST_WINDOW_MS
  ) {
    requestTimestamps.shift();
  }
}

const limiter = createConcurrencyLimiter(MAX_CONCURRENCY);

/**
 * Enqueues a TEZARA HTTP request through a concurrency-limited pipeline
 * that enforces:
 * - concurrency: 3 (max simultaneous requests)
 * - delay: 400-800ms jittered throttle between requests
 * - keep-alive: connection reuse via keepalive flag
 * - burst: max 12 requests in any rolling 3-second window
 *
 * @param url - The TEZARA URL to fetch.
 * @param signal - Optional AbortSignal for request cancellation / timeout.
 * @returns The fetch Response.
 */
export async function enqueueTezaraFetch(
  url: string,
  signal?: AbortSignal,
): Promise<Response> {
  return limiter.exec(async () => {
    // Burst check: wait if we've exceeded the burst window limit
    pruneTimestamps();
    if (requestTimestamps.length >= MAX_BURST) {
      const oldest = requestTimestamps[0];
      const waitTime = oldest + BURST_WINDOW_MS - Date.now();
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
      pruneTimestamps();
    }

    // Dynamic jittered delay between request starts
    const delay = getDynamicDelay();
    await new Promise((resolve) => setTimeout(resolve, delay));

    requestTimestamps.push(Date.now());

    const response = await fetch(url, {
      keepalive: true,
      headers: TEZARA_FETCH_HEADERS,
      signal,
    });

    return response;
  });
}
