import { withRetry } from "@/lib/api-utils";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import type { CandidateSource } from "./types";

interface S2Author {
  authorId?: string;
  name?: string;
}

interface S2ExternalIds {
  DOI?: string;
  CorpusId?: number;
  ArXiv?: string;
  PubMed?: string;
}

interface S2PaperRecommendation {
  paperId: string;
  corpusId?: number;
  externalIds?: S2ExternalIds;
  url?: string;
  title: string;
  abstract?: string;
  venue?: string;
  year?: number;
  citationCount?: number;
  influentialCitationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: {
    url?: string;
    status?: string;
  };
  authors?: S2Author[];
}

interface S2RecommendationsResponse {
  recommendedPapers?: S2PaperRecommendation[];
}

const S2_RETRYABLE = "S2_RETRYABLE_ERROR";

/**
 * Serializes Semantic Scholar recommendation requests (max 1 in-flight) to
 * stay within the service's rate ceiling and avoid 429 responses.
 */
const semanticScholarRequestQueue = createConcurrencyLimiter(1);

/**
 * Queries Semantic Scholar Recommendations API (v1) concurrently alongside OpenAlex.
 *
 * @param positivePaperIds - List of paper identifiers (e.g. "DOI:10.1038/...", "CorpusId:...").
 * @param limit - Max recommendations to return (default 50).
 * @returns Array of CandidateSource items from Semantic Scholar.
 */
export async function fetchSemanticScholarRecommendations(
  positivePaperIds: string[],
  limit = 50,
): Promise<CandidateSource[]> {
  if (positivePaperIds.length === 0) return [];

  const fields = [
    "paperId",
    "corpusId",
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
  ].join(",");

  const endpoint = `https://api.semanticscholar.org/recommendations/v1/papers?limit=${limit}&fields=${fields}`;

  const executeFetch = async (useKey: boolean): Promise<Response | null> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (useKey && process.env.SEMANTIC_SCHOLAR_API_KEY) {
      headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        positivePaperIds,
        negativePaperIds: [],
      }),
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

  try {
    const executeQueued = (useKey: boolean): Promise<Response | null> =>
      semanticScholarRequestQueue.exec(() =>
        withRetry(() => executeFetch(useKey), {
          maxRetries: 1,
          baseDelay: 1000,
          isRetryable: (err) =>
            err instanceof Error && err.message === S2_RETRYABLE,
        }),
      );

    let response = await executeQueued(true);

    if (!response) {
      // Retry once without key if 403 or auth error occurred
      response = await executeQueued(false);
    }

    if (!response) return [];

    const data = (await response.json()) as S2RecommendationsResponse;
    const papers = data.recommendedPapers ?? [];

    return papers.map((p): CandidateSource => {
      const authors = (p.authors ?? [])
        .map((a) => a.name ?? "")
        .filter(Boolean);

      const doi = p.externalIds?.DOI ?? undefined;
      const pdfUrl = p.openAccessPdf?.url ?? undefined;

      return {
        title: p.title,
        authors,
        publisher: p.venue,
        publicationYear: p.year,
        doi,
        corpusId: p.corpusId ?? p.externalIds?.CorpusId,
        citationCount: p.citationCount ?? 0,
        influentialCitationCount: p.influentialCitationCount ?? 0,
        pdfUrl,
        sourceOrigin: "forward_s2",
      };
    });
  } catch {
    return [];
  }
}
