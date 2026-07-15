import { parseOpenAlexResults, parseOpenAlexMetadataResults } from "./parser";
import { createGapEnforcedQueue } from "@/lib/rate-limiter";
import type { RawPaper, RefMetadata } from "../literature-review-papers";
import { CROSSREF_USER_AGENT, withRetry } from "@/lib/api-utils";

/**
 * Global gap-enforced queue for OpenAlex API calls.
 * Enforces ~1 request/second — every logical request (including its
 * retries) is serialised with a minimum 1000ms gap after the previous one.
 */
const openAlexQueue = createGapEnforcedQueue<unknown>(1000);

const OPENALEX_RETRYABLE = "OPENALEX_RETRYABLE_ERROR";

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
      "id,title,type,authorships,relevance_score,doi,referenced_works,language",
  });

  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) {
    params.set("api_key", apiKey);
  }

  return (await openAlexQueue.exec(() =>
    queryOpenAlexWorks(params, checkCancelled),
  )) as RawPaper[];
}

export type { RefMetadata };

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
 * Resolves the correct author(s) for a given academic work title programmatically.
 * Queries OpenAlex duplicates, filters out book reviews/empty authors,
 * and selects the author associated with the highest cumulative citation count.
 *
 * @param title - Raw title of the academic work
 * @returns Array of resolved author names
 */
export async function healAuthorsByTitle(title: string): Promise<string[]> {
  const trimmedTitle = title.substring(0, 1000);
  const params = new URLSearchParams({
    filter: `title.search:${trimmedTitle}`,
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
