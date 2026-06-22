import type { Logger } from "./logger";
import type { TezaraThesisSummary, TezaraThesisDetails } from "./types";
import { parseTezaraDetails, parseTezaraSearchResults } from "./tezara-parser";

const TEZARA_FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
} as const;

const MAX_RETRIES = 3;

/**
 * Fetches a URL with exponential backoff retry logic.
 *
 * @param url - The URL to fetch.
 * @param headers - The request headers.
 * @param logger - Optional Logger instance.
 * @returns The fetch Response if successful, or null after all retries fail.
 */
async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  logger?: Logger,
): Promise<Response | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { headers });
      if (response.ok) return response;
      logger?.warn("tezara_retry_status", {
        service: "tezara",
        filePath: "src/lib/tezara.ts",
        step: "fetch_retry",
        data: { url, attempt, status: response.status },
      });
    } catch (err) {
      logger?.warn("tezara_retry_network", {
        service: "tezara",
        filePath: "src/lib/tezara.ts",
        step: "fetch_retry",
        data: { url, attempt },
        error: err,
      });
    }
    if (attempt < MAX_RETRIES) {
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  logger?.warn("tezara_retry_exhausted", {
    service: "tezara",
    filePath: "src/lib/tezara.ts",
    step: "fetch_retry",
    data: { url, maxRetries: MAX_RETRIES },
  });
  return null;
}

/**
 * Executes a search for a single page of thesis results from Tezara.
 *
 * @param query - The search query term.
 * @param page - The page number to fetch.
 * @param logger - Optional Logger instance.
 * @param advanced - Whether to use the advanced search query parameter.
 * @returns A list of thesis summary results.
 */
export async function searchTezaraPage(
  query: string,
  page: number,
  logger?: Logger,
  advanced = false,
): Promise<TezaraThesisSummary[]> {
  const startTime = performance.now();
  try {
    const url = `https://tezara.org/search?q=${encodeURIComponent(query)}&page=${page}${advanced ? "&advanced=true" : ""}`;
    const response = await fetchWithRetry(url, TEZARA_FETCH_HEADERS, logger);

    if (!response) {
      const durationMs = performance.now() - startTime;
      logger?.warn("search_filtered", {
        service: "tezara",
        filePath: "src/lib/tezara.ts",
        step: "page_search",
        durationMs,
        data: { query, page, status: "retry_exhausted" },
      });
      return [];
    }

    const html = await response.text();
    const results = parseTezaraSearchResults(html, logger);
    const durationMs = performance.now() - startTime;

    if (results.length === 0) {
      logger?.warn("search_empty", {
        service: "tezara",
        filePath: "src/lib/tezara.ts",
        step: "page_search",
        durationMs,
        data: { query, page },
      });
    }

    return results;
  } catch (err) {
    const durationMs = performance.now() - startTime;
    logger?.error("search_filtered", {
      service: "tezara",
      filePath: "src/lib/tezara.ts",
      step: "page_search",
      durationMs,
      data: { query, page },
      error: err,
    });
    return [];
  }
}

/**
 * Searches Tezara and returns results from the first page.
 *
 * @param query - The search query term.
 * @param logger - Optional Logger instance.
 * @param advanced - Whether to use the advanced search query parameter.
 * @returns A list of unique thesis summaries up to 60 items.
 */
export async function searchTezara(
  query: string,
  logger?: Logger,
  advanced = false,
): Promise<TezaraThesisSummary[]> {
  const page1Results = await searchTezaraPage(query, 1, logger, advanced);
  return page1Results;
}

/**
 * Fetches details of a single thesis from Tezara by ID.
 * Parses the rendered HTML page directly via cheerio.
 * Merges metadata from the list-page summary with abstract and PDF URL from the detail page.
 *
 * @param summary - The thesis summary from search results.
 * @param logger - Optional Logger instance.
 * @returns Thesis details object, or null if fetching or parsing fails.
 */
export async function fetchThesisDetails(
  summary: TezaraThesisSummary,
  logger?: Logger,
): Promise<TezaraThesisDetails | null> {
  const startTime = performance.now();
  try {
    const url = `https://tezara.org/theses/${summary.id}`;
    const response = await fetchWithRetry(url, TEZARA_FETCH_HEADERS, logger);

    if (!response) {
      const durationMs = performance.now() - startTime;
      logger?.warn("search_filtered", {
        service: "tezara",
        filePath: "src/lib/tezara.ts",
        step: "fetch_details",
        durationMs,
        data: { thesisId: summary.id, status: "retry_exhausted" },
      });
      return null;
    }

    const html = await response.text();
    const partialDetails = parseTezaraDetails(html, summary.id, logger);

    if (!partialDetails) {
      const durationMs = performance.now() - startTime;
      logger?.warn("search_empty", {
        service: "tezara",
        filePath: "src/lib/tezara.ts",
        step: "fetch_details",
        durationMs,
        data: {
          thesisId: summary.id,
          reason: "Thesis metadata not found in response",
        },
      });
      return null;
    }

    return {
      ...summary,
      abstract: partialDetails.abstract,
      yokPdfUrl: partialDetails.yokPdfUrl,
    };
  } catch (err) {
    const durationMs = performance.now() - startTime;
    logger?.error("search_filtered", {
      service: "tezara",
      filePath: "src/lib/tezara.ts",
      step: "fetch_details",
      durationMs,
      data: { thesisId: summary.id },
      error: err,
    });
    return null;
  }
}
