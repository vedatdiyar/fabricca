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
