import { createConcurrencyLimiter } from "../rate-limiter";

const TEZARA_FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  connection: "keep-alive",
} as const;

const MAX_CONCURRENCY = 24;

const limiter = createConcurrencyLimiter(MAX_CONCURRENCY);

/**
 * Enqueues a TEZARA HTTP request through a concurrency-limited pipeline.
 * No artificial delay or burst-limiting is applied; only max-concurrency
 * (24 simultaneous requests) is enforced via the shared semaphore.
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
    const response = await fetch(url, {
      keepalive: true,
      headers: TEZARA_FETCH_HEADERS,
      signal,
    });

    return response;
  });
}
