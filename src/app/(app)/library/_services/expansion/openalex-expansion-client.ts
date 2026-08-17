import { OPENALEX_USER_AGENT, withRetry } from "@/lib/api-utils";
import { createRateLimiter } from "@/lib/rate-limiter";
import { OPENALEX_SEMANTIC_LIMITS } from "@/core/config/rate-limits";
import type { CandidateSource } from "./types";

interface OpenAlexWorkItem {
  id: string;
  title?: string;
  doi?: string;
  publication_year?: number;
  cited_by_count?: number;
  relevance_score?: number;
  authorships?: Array<{
    author?: {
      display_name?: string;
    };
  }>;
  primary_location?: {
    source?: {
      display_name?: string;
    };
    pdf_url?: string;
  };
  open_access?: {
    is_oa?: boolean;
    oa_url?: string;
  };
}

const OPENALEX_RETRYABLE = "OPENALEX_RETRYABLE_ERROR";

/**
 * Limiter for OpenAlex expansion requests. The forward-citation endpoint may
 * combine `filter` with a `search` query, so requests keep the 1 req/s semantic
 * search cadence to avoid 429 responses.
 */
const openAlexExpansionQueue = createRateLimiter(OPENALEX_SEMANTIC_LIMITS);

/**
 * Retry policy for OpenAlex expansion requests: retries 429/5xx/network errors
 * with full-jitter exponential backoff.
 */
function buildOpenAlexExpansionRetryOptions() {
  return {
    maxRetries: 3,
    baseDelay: 1500,
    isRetryable: (err: unknown) => {
      if (err instanceof Error) {
        return (
          err.message === OPENALEX_RETRYABLE ||
          err instanceof TypeError ||
          err.name === "AbortError"
        );
      }
      return false;
    },
  };
}

/**
 * Fetches an OpenAlex URL through the gap-enforced queue, throwing a retryable
 * error on 429/5xx so the caller's retry policy can back off.
 *
 * @param url - The OpenAlex API URL to fetch.
 * @returns The HTTP response, or null on non-retryable non-2xx.
 */
async function fetchOpenAlexUrl(url: string): Promise<Response | null> {
  const fetchWithRetry = async (): Promise<Response | null> => {
    const res = await fetch(url, {
      headers: { "User-Agent": OPENALEX_USER_AGENT },
      signal: AbortSignal.timeout(30000),
    });

    if (res.status === 429 || res.status >= 500) {
      throw new Error(OPENALEX_RETRYABLE);
    }

    if (!res.ok) return null;

    return res;
  };

  return openAlexExpansionQueue.exec(() =>
    withRetry(fetchWithRetry, buildOpenAlexExpansionRetryOptions()),
  );
}

/**
 * Queries OpenAlex API for works citing a batch of seed works (forward citations).
 * When searchQuery is provided, combines filter=cites:W... with search=... to compute relevance_score.
 *
 * @param seedIdsOrDois - List of OpenAlex Work IDs (e.g. "W2741809807") or DOIs.
 * @param searchQuery - Optional text query to compute relevance_score against.
 * @param perPage - Number of results to fetch (default 50).
 * @returns Array of normalized CandidateSource items from OpenAlex.
 */
export async function fetchOpenAlexForwardCitations(
  seedIdsOrDois: string[],
  searchQuery?: string,
  perPage = 50,
): Promise<CandidateSource[]> {
  if (seedIdsOrDois.length === 0) return [];

  const cleanIds = seedIdsOrDois
    .map((id) => id.replace("https://openalex.org/", "").trim())
    .filter(Boolean);

  if (cleanIds.length === 0) return [];

  const filterValue = `cites:${cleanIds.join("|")}`;
  const selectFields =
    "id,title,authorships,doi,publication_year,cited_by_count,primary_location,open_access,topics,relevance_score";

  const params = new URLSearchParams({
    filter: filterValue,
    select: selectFields,
    per_page: String(perPage),
  });

  if (searchQuery && searchQuery.trim().length > 0) {
    params.set("search", searchQuery.trim().substring(0, 500));
  } else {
    params.set("sort", "cited_by_count:desc");
  }

  if (process.env.OPENALEX_API_KEY) {
    params.set("api_key", process.env.OPENALEX_API_KEY);
  }

  const url = `https://api.openalex.org/works?${params.toString().replace(/\+/g, "%20")}`;

  try {
    const response = await fetchOpenAlexUrl(url);

    if (!response) return [];

    const data = (await response.json()) as {
      results?: OpenAlexWorkItem[];
    };

    let rawResults = data.results ?? [];

    // Fallback: If search query yielded 0 results, query again without search parameter
    if (rawResults.length === 0 && searchQuery) {
      params.delete("search");
      params.set("sort", "cited_by_count:desc");
      const fallbackUrl = `https://api.openalex.org/works?${params.toString().replace(/\+/g, "%20")}`;
      const fallbackRes = await fetchOpenAlexUrl(fallbackUrl);

      if (fallbackRes) {
        const fallbackData = (await fallbackRes.json()) as {
          results?: OpenAlexWorkItem[];
        };
        rawResults = fallbackData.results ?? [];
      }
    }

    return rawResults.map((work): CandidateSource => {
      const authors = (work.authorships ?? [])
        .map((a) => a.author?.display_name ?? "")
        .filter(Boolean);

      const doi = work.doi
        ? work.doi.replace("https://doi.org/", "")
        : undefined;

      const pdfUrl =
        work.primary_location?.pdf_url ?? work.open_access?.oa_url ?? undefined;

      return {
        title: work.title ?? "Untitled Work",
        authors,
        publisher: work.primary_location?.source?.display_name,
        publicationYear: work.publication_year,
        doi,
        openalexId: work.id.replace("https://openalex.org/", ""),
        citationCount: work.cited_by_count ?? 0,
        relevanceScore: work.relevance_score ?? 0,
        pdfUrl,
        sourceOrigin: "forward_openalex",
      };
    });
  } catch {
    return [];
  }
}
