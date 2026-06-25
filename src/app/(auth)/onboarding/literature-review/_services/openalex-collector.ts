/**
 * OpenAlex sequential search collector.
 *
 * Encapsulates the OpenAlex HTTP search loop with rate-limit throttle and
 * retry logic. Both single-box and batch-box pipelines call this service
 * instead of duplicating the search loop.
 */

import { searchOpenAlex } from "./openalex/client";
import { mergePapers } from "./literature-review-papers";
import type { RawPaper, ValidatedPaper } from "./literature-review-papers";
import type { Logger } from "@/lib/logger";

/**
 * OpenAlex rate limit: minimum delay (ms) between sequential search requests.
 * OpenAlex enforces ~1 request/second for non-authenticated use.
 * 1100ms = 1s base + 100ms safety margin.
 */
const OPENALEX_REQUEST_DELAY_MS = 1100;

/**
 * Retries a single OpenAlex semantic search with exponential back-off on
 * network / 429 errors.
 *
 * @param query - The search query string
 * @param logger - Logger instance
 * @param maxAttempts - Maximum retry attempts (default 3)
 * @returns Raw papers from OpenAlex
 */
async function withOpenAlexRetry(
  query: string,
  logger: Logger,
  maxAttempts = 3,
): Promise<RawPaper[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await searchOpenAlex(query);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxAttempts) {
        const delayMs = Math.random() * 300 + 200;
        logger.warn("openalex_rate_limit_retry", {
          service: "literature",
          filePath:
            "onboarding/literature-review/_services/openalex-collector.ts",
          data: {
            attempt,
            maxAttempts,
            delayMs: Math.round(delayMs),
            query: query.substring(0, 120),
            error: lastError.message,
          },
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError ?? new Error("OpenAlex isteği başarısız oldu");
}

/**
 * Runs a sequential OpenAlex search for all given queries with rate-limit
 * throttle between requests, then deduplicates the combined results.
 *
 * @param queries - Array of semantic search query strings
 * @param logger - Logger instance
 * @param delayMs - Throttle delay between queries (default 1100ms)
 * @returns Deduplicated validated papers
 */
export async function collectOpenAlexResults(
  queries: string[],
  logger: Logger,
  delayMs = OPENALEX_REQUEST_DELAY_MS,
): Promise<ValidatedPaper[]> {
  const searchResultsList: RawPaper[][] = [];
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    if (!query.trim()) continue;

    const results = await withOpenAlexRetry(query, logger);
    searchResultsList.push(results);

    if (i < queries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  const semanticRaw = searchResultsList.flat();
  return mergePapers(semanticRaw);
}
