import { parseOpenAlexResults } from "./parser";
import { createGapEnforcedQueue } from "@/lib/rate-limiter";
import type { RawPaper } from "../literature-review-papers";

/**
 * Global gap-enforced queue for OpenAlex.
 * OpenAlex enforces ~1 request/second — every logical request (including its
 * retries) is serialised with a minimum 1000ms gap after the previous one.
 * The gap counts from completion to next start, so retries within a single
 * request do NOT add extra gap time.
 */
const openAlexQueue = createGapEnforcedQueue<RawPaper[]>(1000);

async function queryOpenAlexWorks(
  params: URLSearchParams,
): Promise<RawPaper[]> {
  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) params.set("api_key", apiKey);
  const url = `https://api.openalex.org/works?${params.toString().replace(/\+/g, "%20")}`;

  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1500;
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "FabriccaAcademicAssistant/1.0" },
        signal: AbortSignal.timeout(30000),
      });

      if (response.status === 429) {
        if (attempt <= MAX_RETRIES) {
          const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          const jitter = backoff * 0.3 * Math.random();
          const delayMs = backoff + jitter;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw new Error("OpenAlex rate limit exceeded (429)");
      }

      if (!response.ok) {
        if (response.status >= 500 && attempt <= MAX_RETRIES) {
          const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          const jitter = backoff * 0.3 * Math.random();
          const delayMs = backoff + jitter;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        return [];
      }

      const data = (await response.json()) as {
        results?: Record<string, unknown>[];
      };
      const results = data.results;
      if (!results) return [];
      return parseOpenAlexResults(results);
    } catch (err) {
      const isRetryable =
        err instanceof Error &&
        (err.message.includes("rate limit") ||
          err instanceof TypeError ||
          err.name === "AbortError");

      if (isRetryable && attempt <= MAX_RETRIES) {
        const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const jitter = backoff * 0.3 * Math.random();
        const delayMs = backoff + jitter;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
}

export async function searchOpenAlex(query: string): Promise<RawPaper[]> {
  const trimmedQuery = query.substring(0, 2000);
  const params = new URLSearchParams({
    "search.semantic": trimmedQuery,
    per_page: "10",
    select:
      "id,title,type,biblio,authorships,publication_year,primary_location,abstract_inverted_index,topics,relevance_score",
  });

  // Route through the global gap-enforced queue.
  // The queue serialises ALL callers (batch-orchestrator, boxes/actions,
  // openalex-collector) into a single pipeline respecting the 1 req/s limit.
  const results = await openAlexQueue.exec(() => queryOpenAlexWorks(params));
  if (results.length === 0) {
    return [];
  }
  return results;
}
