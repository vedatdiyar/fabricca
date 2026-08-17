import { parseOpenAlexResults, parseOpenAlexMetadataResults } from "./parser";
import { createRateLimiter } from "@/lib/rate-limiter";
import {
  OPENALEX_REGULAR_LIMITS,
  OPENALEX_SEMANTIC_LIMITS,
} from "@/config/rate-limits";
import type { RawPaper, RefMetadata } from "../literature-review-papers";
import { CROSSREF_USER_AGENT, withRetry } from "@/lib/api-utils";

/**
 * Queue for semantic search, since OpenAlex enforces 1 req/s for this endpoint.
 */
const semanticQueue = createRateLimiter(OPENALEX_SEMANTIC_LIMITS);

/**
 * Queue for list/filter calls, since OpenAlex allows up to 100 req/s for these endpoints.
 */
const openAlexQueue = createRateLimiter(OPENALEX_REGULAR_LIMITS);

const OPENALEX_RETRYABLE = "OPENALEX_RETRYABLE_ERROR";

/**
 * Queries the OpenAlex works endpoint with retry and cancellation support.
 *
 * @param params - The URL query parameters for the request.
 * @param checkCancelled - Optional callback to abort the request.
 * @returns The parsed raw papers from the query.
 */
async function queryOpenAlexWorks(
  params: URLSearchParams,
  checkCancelled?: () => boolean,
): Promise<RawPaper[]> {
  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) params.set("api_key", apiKey);
  const url = `https://api.openalex.org/works?${params.toString().replace(/\+/g, "%20")}`;

  const fetchWithRetry = async (): Promise<Response | null> => {
    if (checkCancelled?.()) return null;

    const res = await fetch(url, {
      headers: { "User-Agent": CROSSREF_USER_AGENT },
      signal: AbortSignal.timeout(30000),
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

  try {
    const response = await withRetry(fetchWithRetry, {
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

/**
 * Performs a semantic search against OpenAlex for the given query.
 *
 * @param query - The semantic search query text.
 * @param perPage - The number of results to request.
 * @param checkCancelled - Optional callback to abort the request.
 * @returns The matching raw papers.
 */
export async function searchOpenAlex(
  query: string,
  perPage: number,
  checkCancelled?: () => boolean,
): Promise<RawPaper[]> {
  const trimmedQuery = query.substring(0, 1000);
  const params = new URLSearchParams({
    "search.semantic": trimmedQuery,
    per_page: String(perPage),
    select:
      "id,title,type,authorships,relevance_score,doi,referenced_works,language,abstract_inverted_index,cited_by_count",
  });

  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) {
    params.set("api_key", apiKey);
  }

  return (await semanticQueue.exec(() =>
    queryOpenAlexWorks(params, checkCancelled),
  )) as RawPaper[];
}

export type { RefMetadata };

/**
 * Fetches reference metadata for a batch of OpenAlex work IDs.
 *
 * @param ids - The OpenAlex work IDs to fetch metadata for.
 * @param checkCancelled - Optional callback to abort the request.
 * @returns The fetched reference metadata records.
 */
export async function fetchOpenAlexMetadataBatch(
  ids: string[],
  checkCancelled?: () => boolean,
): Promise<RefMetadata[]> {
  if (ids.length === 0) return [];

  const apiKey = process.env.OPENALEX_API_KEY;
  const selectFields = "id,title,authorships,type,doi,language,cited_by_count";
  const results: RefMetadata[] = [];
  const BATCH_SIZE = 50;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    if (checkCancelled?.()) break;

    const batch = ids.slice(i, i + BATCH_SIZE);
    const idParams = batch
      .map((id) => id.replace("https://openalex.org/", ""))
      .join("|");

    const params = new URLSearchParams({
      filter: `openalex:${idParams}`,
      per_page: String(BATCH_SIZE),
      select: selectFields,
    });
    if (apiKey) params.set("api_key", apiKey);

    const url = `https://api.openalex.org/works?${params.toString().replace(/\+/g, "%20")}`;

    const fetchBatch = async (): Promise<Response | null> => {
      if (checkCancelled?.()) return null;

      const res = await fetch(url, {
        headers: { "User-Agent": CROSSREF_USER_AGENT },
        signal: AbortSignal.timeout(30000),
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

    try {
      const response = (await openAlexQueue.exec(async () =>
        withRetry(fetchBatch, {
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
        }),
      )) as Response | null;

      if (!response) continue;
      const data = (await response.json()) as {
        results?: Record<string, unknown>[];
      };
      if (!data.results) continue;

      const parsed = parseOpenAlexMetadataResults(data.results);
      results.push(...parsed);
    } catch {
      continue;
    }
  }

  return results;
}

interface OpenAlexHealCandidate {
  id: string;
  title?: string;
  type?: string;
  cited_by_count?: number;
  authorships?: {
    author?: {
      display_name?: string;
    };
  }[];
  primary_location?: {
    source?: {
      display_name?: string;
      type?: string;
    };
  };
}

/**
 * Resolves the author(s) of an academic work title by querying OpenAlex duplicates and selecting the most cited candidate.
 *
 * @param title - The raw title of the academic work.
 * @returns The resolved author names.
 */
export async function healAuthorsByTitle(title: string): Promise<string[]> {
  const cleanSearchTitle = title
    .replace(/[:\-,\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 200);
  const params = new URLSearchParams({
    filter: `title.search:${cleanSearchTitle}`,
    per_page: "15",
    select: "id,title,type,authorships,cited_by_count,primary_location",
  });
  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) params.set("api_key", apiKey);
  const url = `https://api.openalex.org/works?${params.toString().replace(/\+/g, "%20")}`;

  const fetchFunc = async (): Promise<Response | null> => {
    const res = await fetch(url, {
      headers: { "User-Agent": CROSSREF_USER_AGENT },
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 429) throw new Error(OPENALEX_RETRYABLE);
    if (!res.ok) {
      if (res.status >= 500) throw new Error(OPENALEX_RETRYABLE);
      return null;
    }
    return res;
  };

  try {
    const response = (await openAlexQueue.exec(() =>
      withRetry(fetchFunc, {
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
      }),
    )) as Response | null;

    if (!response) return [];
    const data = (await response.json()) as {
      results?: OpenAlexHealCandidate[];
    };
    const rawResults = data.results ?? [];

    const validCandidates: { authors: string[]; citations: number }[] = [];

    for (const work of rawResults) {
      const authorships = Array.isArray(work.authorships)
        ? (work.authorships as { author?: { display_name?: string } }[])
        : [];
      const authors = authorships
        .map((a) => a.author?.display_name ?? "")
        .filter(Boolean);

      if (authors.length === 0) continue;

      const sourceName = work.primary_location?.source?.display_name ?? "";
      const isBookReview =
        work.type === "book-review" ||
        sourceName.toLowerCase().includes("review") ||
        work.title?.toLowerCase().includes("review on") ||
        work.title?.toLowerCase().includes("review of");

      if (isBookReview) continue;

      validCandidates.push({
        authors,
        citations: work.cited_by_count ?? 0,
      });
    }

    if (validCandidates.length === 0) return [];

    const authorCitationsMap: Record<string, number> = {};
    const authorMap: Record<string, string[]> = {};

    for (const c of validCandidates) {
      const authorKey = c.authors.join(", ");
      authorCitationsMap[authorKey] =
        (authorCitationsMap[authorKey] ?? 0) + c.citations;
      authorMap[authorKey] = c.authors;
    }

    let bestAuthorKey = "";
    let maxCitations = -1;

    for (const [key, citations] of Object.entries(authorCitationsMap)) {
      if (citations > maxCitations) {
        maxCitations = citations;
        bestAuthorKey = key;
      }
    }

    return authorMap[bestAuthorKey] ?? [];
  } catch {
    return [];
  }
}
