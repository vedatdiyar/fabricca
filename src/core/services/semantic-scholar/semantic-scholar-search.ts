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

/**
 * Rate-limited queue ensuring max 1 req/s compliance with Semantic Scholar's free tier.
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

  const executeFetch = async (useKey: boolean): Promise<Response | null> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (useKey && process.env.SEMANTIC_SCHOLAR_API_KEY) {
      headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;
    }

    const res = await fetch(endpoint, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(20000),
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
    const executeQueued = (useKey: boolean): Promise<Response | null> =>
      s2SearchQueue.exec(() =>
        withRetry(() => executeFetch(useKey), {
          maxRetries: 1,
          baseDelay: 1200,
          isRetryable: (err) =>
            err instanceof Error && err.message === S2_RETRYABLE,
        }),
      );

    let response = await executeQueued(true);

    if (!response) {
      // Retry once unauthenticated if 403 or API key issue occurred
      response = await executeQueued(false);
    }

    if (!response) return [];

    const json = (await response.json()) as S2SearchResponse;
    return json.data ?? [];
  } catch {
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

    const res = await s2SearchQueue.exec(() =>
      fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          positivePaperIds,
        }),
        signal: AbortSignal.timeout(15000),
      }),
    );

    if (!res.ok) return [];

    const json = (await res.json()) as {
      recommendedPapers?: SemanticScholarPaper[];
    };
    return json.recommendedPapers ?? [];
  } catch {
    return [];
  }
}

