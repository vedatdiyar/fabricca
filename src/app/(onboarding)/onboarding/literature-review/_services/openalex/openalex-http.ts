import { createRateLimiter } from "@/lib/rate-limiter";
import {
  OPENALEX_REGULAR_LIMITS,
  OPENALEX_SEMANTIC_LIMITS,
} from "@/core/config/rate-limits";
import { OPENALEX_BASE_URL } from "@/core/config/endpoints";
import { OPENALEX_USER_AGENT } from "@/lib/api-utils";
import { withRetry } from "@/core/services/ai/llm-retry";
import { parseOpenAlexResults } from "./parser";
import type { RawPaper } from "../literature-review-papers";

/**
 * Architecture note: This HTTP layer transports only `URLSearchParams` with a
 * `search.semantic` text value. OpenAlex embeds that text server-side with
 * GTE Large EN (1024d). No local embedding (HF E5 768d / BGE-M3 1024d) enters
 * this path — vector spaces are strictly isolated by design.
 */

/** Queue for semantic search, since OpenAlex enforces 1 req/s for this endpoint. */
export const semanticQueue = createRateLimiter(OPENALEX_SEMANTIC_LIMITS);

/** Queue for list/filter calls, since OpenAlex allows up to 100 req/s for these endpoints. */
export const openAlexQueue = createRateLimiter(OPENALEX_REGULAR_LIMITS);

export const OPENALEX_RETRYABLE = "OPENALEX_RETRYABLE_ERROR";

/** Execution timeout for a single OpenAlex HTTP call — starts *after* turnstile dequeue, not while queued. */
export const OPENALEX_EXECUTION_TIMEOUT_MS = 35000;

/**
 * Executes an HTTP fetch against OpenAlex with timeout, status checking, and automatic retry.
 * Timeout is execution-only: the AbortSignal is created inside the queued `exec` callback
 * (see `openalex-search.ts`), so queue wait time does not consume the 35 s budget.
 *
 * @param url - The fully qualified URL to fetch.
 * @param checkCancelled - Optional callback to abort the request.
 * @returns The Response object or null when cancelled or on fatal error.
 */
export async function fetchWithOpenAlexRetry(
  url: string,
  checkCancelled?: () => boolean,
  externalSignal?: AbortSignal,
): Promise<Response | null> {
  const fetchFunc = async (): Promise<Response | null> => {
    if (checkCancelled?.()) return null;
    if (externalSignal?.aborted) return null;

    // Combine external AbortSignal (from withProviderTimeout) with execution timeout
    const timeoutSignal = AbortSignal.timeout(OPENALEX_EXECUTION_TIMEOUT_MS);
    const signal = externalSignal
      ? // Node 20+ / modern runtimes support AbortSignal.any
        typeof (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any ===
        "function"
        ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any([
            externalSignal,
            timeoutSignal,
          ])
        : externalSignal
      : timeoutSignal;

    const res = await fetch(url, {
      headers: { "User-Agent": OPENALEX_USER_AGENT },
      signal,
    });

    if (res.status === 429) {
      throw new Error(OPENALEX_RETRYABLE);
    }

    if (!res.ok) {
      if (res.status >= 500) {
        throw new Error(OPENALEX_RETRYABLE);
      }
      return null;
    }

    return res;
  };

  return withRetry(fetchFunc, {
    maxRetries: 3,
    baseDelay: 1500,
    isRetryable: (err) => {
      if (err instanceof Error) {
        return (
          err.message === OPENALEX_RETRYABLE ||
          err instanceof TypeError ||
          err.name === "AbortError"
        );
      }
      return false;
    },
  });
}

/**
 * Queries the OpenAlex works endpoint with retry and cancellation support.
 *
 * @param params - The URL query parameters for the request.
 * @param checkCancelled - Optional callback to abort the request.
 * @returns The parsed raw papers from the query.
 */
export async function queryOpenAlexWorks(
  params: URLSearchParams,
  checkCancelled?: () => boolean,
  externalSignal?: AbortSignal,
): Promise<RawPaper[]> {
  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) params.set("api_key", apiKey);
  const url = `${OPENALEX_BASE_URL}/works?${params.toString().replace(/\+/g, "%20")}`;

  try {
    const response = await fetchWithOpenAlexRetry(url, checkCancelled, externalSignal);
    if (!response) return [];

    const data = (await response.json()) as {
      results?: Record<string, unknown>[];
    };
    if (!data.results) return [];
    return parseOpenAlexResults(data.results);
  } catch {
    return [];
  }
}
