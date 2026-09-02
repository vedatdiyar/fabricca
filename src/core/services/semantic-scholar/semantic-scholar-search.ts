import { withRetry } from "@/core/services/ai/llm-retry";
import { createRateLimiter } from "@/lib/rate-limiter";
import { SEMANTIC_SCHOLAR_LIMITS } from "@/core/config/rate-limits";

export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  authors?: Array<{ authorId?: string; name: string }>;
  year?: number;
  venue?: string;
  citationCount?: number;
  influentialCitationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: { url?: string };
  externalIds?: { DOI?: string; CorpusId?: number };
  publicationTypes?: string[];
  url?: string;
}

interface S2SearchResponse {
  total?: number;
  offset?: number;
  data?: SemanticScholarPaper[];
}

const S2_RETRYABLE = "S2_SEARCH_RETRYABLE_ERROR";

/** Execution timeout for S2 search — started AFTER turnstile dequeue, not while queued. */
const S2_SEARCH_EXECUTION_TIMEOUT_MS = 20000;
/** Execution timeout for S2 recommendations — started AFTER turnstile dequeue. */
const S2_RECOMMENDATIONS_EXECUTION_TIMEOUT_MS = 15000;

/**
 * Rate-limited queue ensuring max 1 req/s compliance with Semantic Scholar's free tier.
 * Turnstile pacing: concurrency 1 + minIntervalMs 1050 guarantees at most 1 request
 * per second is dispatched (no micro-burst), matching SEMANTIC_SCHOLAR_LIMITS (60 RPM).
 */
const s2SearchQueue = createRateLimiter(SEMANTIC_SCHOLAR_LIMITS);

/**
 * Searches Semantic Scholar for academic papers matching the given query string.
 * Note per API doc: Hyphenated query terms yield no matches in Semantic Scholar,
 * so hyphens are automatically normalized to spaces.
 *
 * @param query - The search query (English keywords or semantic phrasing).
 * @param limit - Maximum number of papers to retrieve (default 10).
 * @returns Array of matching Semantic Scholar papers.
 */
export async function searchSemanticScholarPapers(
  query: string,
  limit = 10,
  externalSignal?: AbortSignal,
): Promise<SemanticScholarPaper[]> {
  // S2 API doc: "Hyphenated query terms yield no matches (replace it with space to find matches)"
  const sanitized = query.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  if (!sanitized) return [];

  const fields = [
    "paperId",
    "title",
    "abstract",
    "authors",
    "venue",
    "year",
    "citationCount",
    "influentialCitationCount",
    "isOpenAccess",
    "openAccessPdf",
    "externalIds",
    "publicationTypes",
    "url",
  ].join(",");

  const endpoint = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
    sanitized,
  )}&limit=${limit}&fields=${fields}`;

  /**
   * Execution-isolated fetch: timeout + AbortSignal.any are created INSIDE
   * s2SearchQueue.exec so queue wait (turnstile pacing) does NOT consume the
   * provider/execution budget. The externalSignal from withProviderTimeout (35 s)
   * is combined here — abort closes the socket immediately and preserves S2 quota.
   */
  const executeFetch = async (): Promise<Response | null> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
      headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;
    }

    if (externalSignal?.aborted) throw new DOMException("Aborted", "AbortError");
    // Execution timeout starts only after dequeue — queue wait does not count.
    const timeoutSignal = AbortSignal.timeout(S2_SEARCH_EXECUTION_TIMEOUT_MS);
    const signal = externalSignal
      ? typeof (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any ===
        "function"
        ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any([
            externalSignal,
            timeoutSignal,
          ])
        : (() => {
            // Fallback when AbortSignal.any is unavailable: create composite controller
            const controller = new AbortController();
            const onAbort = () => controller.abort();
            externalSignal.addEventListener("abort", onAbort, { once: true });
            timeoutSignal.addEventListener("abort", onAbort, { once: true });
            if (externalSignal.aborted || timeoutSignal.aborted) controller.abort();
            return controller.signal;
          })()
      : timeoutSignal;

    const res = await fetch(endpoint, {
      method: "GET",
      headers,
      signal,
    });

    if (res.status === 429 || res.status >= 500) {
      throw new Error(S2_RETRYABLE);
    }

    if (!res.ok) {
      return null;
    }

    return res;
  };

  try {
    const response = await s2SearchQueue.exec(() =>
      withRetry(() => executeFetch(), {
        maxRetries: 3,
        baseDelay: 1500,
        isRetryable: (err) =>
          err instanceof Error && err.message === S2_RETRYABLE,
      }),
    );

    if (!response) return [];

    const json = (await response.json()) as S2SearchResponse;
    return json.data ?? [];
  } catch (err) {
    // Propagate abort so withProviderTimeout can return fallback & log; other errors degrade to [].
    if (
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError")
    )
      throw err;
    return [];
  }
}

/**
 * Retrieves recommended papers from Semantic Scholar based on positive seed paper IDs.
 * Implements the official Semantic Scholar Recommendations API v1.
 *
 * @param positivePaperIds - Array of Semantic Scholar paper IDs or DOIs.
 * @param limit - Maximum number of recommended papers (default 5, max 500).
 * @returns Array of recommended Semantic Scholar papers.
 */
export async function getSemanticScholarRecommendations(
  positivePaperIds: string[],
  limit = 5,
  externalSignal?: AbortSignal,
): Promise<SemanticScholarPaper[]> {
  if (positivePaperIds.length === 0) return [];

  const fields = [
    "paperId",
    "title",
    "abstract",
    "authors",
    "venue",
    "year",
    "citationCount",
    "influentialCitationCount",
    "externalIds",
    "url",
  ].join(",");

  const endpoint = `https://api.semanticscholar.org/recommendations/v1/papers?limit=${limit}&fields=${fields}`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
      headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;
    }

    const res = await s2SearchQueue.exec(async () => {
      if (externalSignal?.aborted) throw new DOMException("Aborted", "AbortError");
      // Execution timeout starts only after dequeue — queue wait does not count.
      const timeoutSignal = AbortSignal.timeout(
        S2_RECOMMENDATIONS_EXECUTION_TIMEOUT_MS,
      );
      const signal = externalSignal
        ? typeof (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any ===
          "function"
          ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any([
              externalSignal,
              timeoutSignal,
            ])
          : (() => {
              const controller = new AbortController();
              const onAbort = () => controller.abort();
              externalSignal.addEventListener("abort", onAbort, { once: true });
              timeoutSignal.addEventListener("abort", onAbort, { once: true });
              if (externalSignal.aborted || timeoutSignal.aborted) controller.abort();
              return controller.signal;
            })()
        : timeoutSignal;

      return fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          positivePaperIds,
        }),
        signal,
      });
    });

    if (!res.ok) return [];

    const json = (await res.json()) as {
      recommendedPapers?: SemanticScholarPaper[];
    };
    return json.recommendedPapers ?? [];
  } catch (err) {
    if (
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError")
    )
      throw err;
    return [];
  }
}
