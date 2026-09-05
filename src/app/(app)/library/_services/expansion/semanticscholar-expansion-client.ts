import { withRetry } from "@/core/services/ai/llm-retry";
import { createRateLimiter } from "@/lib/rate-limiter";
import { SEMANTIC_SCHOLAR_LIMITS } from "@/core/config/rate-limits";
import { SEMANTIC_SCHOLAR_RECOMMENDATIONS_URL } from "@/core/config/endpoints";
import type {
  CandidateSource,
  S2RecommendationItem,
  S2RecommendationsResponse,
} from "./types";

const S2_RETRYABLE = "S2_RETRYABLE_ERROR";

/**
 * Limiter for Semantic Scholar Recommendations requests.
 * Enforces a turnstile gap (1.1s) and single concurrency to prevent 429 responses.
 */
const s2RecommendationsQueue = createRateLimiter(SEMANTIC_SCHOLAR_LIMITS);

/**
 * Formats an academic identifier for Semantic Scholar API.
 * DOIs must be prefixed with "DOI:".
 *
 * @param id - Raw identifier (e.g. "10.1016/..." or "CorpusId:123" or "DOI:...").
 * @returns Formatted identifier string.
 */
export function formatS2Identifier(id: string): string {
  const trimmed = id.trim();
  if (
    trimmed.startsWith("DOI:") ||
    trimmed.startsWith("CorpusId:") ||
    trimmed.startsWith("ArXiv:") ||
    trimmed.startsWith("MAG:") ||
    trimmed.startsWith("ACL:") ||
    trimmed.startsWith("PMID:")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("10.")) {
    return `DOI:${trimmed}`;
  }
  return trimmed;
}

/**
 * Builds retry options for Semantic Scholar Recommendations API.
 */
function buildS2RetryOptions() {
  return {
    maxRetries: 3,
    baseDelay: 1500,
    isRetryable: (err: unknown) => {
      if (err instanceof Error) {
        return (
          err.message === S2_RETRYABLE ||
          err instanceof TypeError ||
          err.name === "AbortError"
        );
      }
      return false;
    },
  };
}

/**
 * Normalizes an S2 paper item into Fabricca's unified CandidateSource.
 *
 * @param item - Raw recommendation item from S2.
 * @returns Normalized CandidateSource item.
 */
function mapS2ItemToCandidateSource(item: S2RecommendationItem): CandidateSource {
  const rawDoi = item.externalIds?.DOI?.trim();
  const cleanDoi = rawDoi?.replace(/^https?:\/\/doi\.org\//i, "");

  const authors =
    item.authors
      ?.map((a) => a.name.trim())
      .filter((name) => name.length > 0) ?? [];

  const rawPdfUrl = item.openAccessPdf?.url?.trim();
  const pdfUrl = rawPdfUrl && rawPdfUrl.length > 5 ? rawPdfUrl : undefined;

  return {
    title: item.title?.trim() || "Untitled Paper",
    authors: authors.length > 0 ? authors : ["Unknown Author"],
    publisher: item.venue?.trim() || undefined,
    publicationYear: item.year ?? undefined,
    doi: cleanDoi,
    corpusId:
      item.corpusId ??
      (typeof item.externalIds?.CorpusId === "number"
        ? item.externalIds.CorpusId
        : undefined),
    sourceOrigin: "recommendation_s2",
    citationCount: item.citationCount ?? 0,
    influentialCitationCount: item.influentialCitationCount ?? 0,
    pdfUrl,
  };
}

export interface FetchS2RecommendationsParams {
  positiveIds: string[];
  negativeIds?: string[];
  limit?: number;
}

/**
 * Calls Semantic Scholar Recommendations API v1.0 (/recommendations/v1/papers/)
 * to fetch recommended papers for given positive and negative seed papers.
 *
 * @param params - Positive and negative paper identifiers and optional limit.
 * @returns Array of normalized CandidateSource items.
 */
export async function fetchSemanticScholarRecommendations(
  params: FetchS2RecommendationsParams,
): Promise<CandidateSource[]> {
  const { positiveIds, negativeIds = [], limit = 50 } = params;

  const formattedPositive = positiveIds
    .map(formatS2Identifier)
    .filter((id) => id.length > 4);

  if (formattedPositive.length === 0) {
    return [];
  }

  const formattedNegative = negativeIds
    .map(formatS2Identifier)
    .filter((id) => id.length > 4);

  const fields = [
    "paperId",
    "corpusId",
    "externalIds",
    "url",
    "title",
    "abstract",
    "venue",
    "year",
    "citationCount",
    "influentialCitationCount",
    "isOpenAccess",
    "openAccessPdf",
    "fieldsOfStudy",
    "authors",
  ].join(",");

  const targetUrl = `${SEMANTIC_SCHOLAR_RECOMMENDATIONS_URL}?limit=${Math.min(limit, 100)}&fields=${fields}`;

  const payload: { positivePaperIds: string[]; negativePaperIds?: string[] } = {
    positivePaperIds: formattedPositive,
  };

  if (formattedNegative.length > 0) {
    payload.negativePaperIds = formattedNegative;
  }

  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();

  const performFetch = async (useApiKey: boolean): Promise<Response | null> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (useApiKey && apiKey && apiKey.length > 0) {
      headers["x-api-key"] = apiKey;
    }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (res.status === 429 || res.status >= 500) {
      throw new Error(S2_RETRYABLE);
    }

    if (!res.ok) {
      return null;
    }

    return res;
  };

  const executeWithQueue = async (
    useApiKey: boolean,
  ): Promise<Response | null> => {
    return s2RecommendationsQueue.exec(() =>
      withRetry(() => performFetch(useApiKey), buildS2RetryOptions()),
    );
  };

  let response: Response | null = null;

  try {
    // Primary attempt: with API key if configured
    response = await executeWithQueue(Boolean(apiKey));
  } catch {
    // If API key throttled with 429, try unauthenticated fallback as a safety net
    if (apiKey) {
      try {
        response = await executeWithQueue(false);
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  if (!response || !response.ok) {
    return [];
  }

  try {
    const data = (await response.json()) as S2RecommendationsResponse;
    const papers = data.recommendedPapers ?? [];

    return papers
      .filter((p) => p && p.title && p.title.trim().length >= 5)
      .map(mapS2ItemToCandidateSource);
  } catch {
    return [];
  }
}
