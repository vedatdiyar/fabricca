import type { Logger } from "./logger";
import type { TezaraThesisSummary, TezaraThesisDetails } from "./types";
import { parseTezaraDetails, parseTezaraSearchResults } from "./tezara-parser";

const TEZARA_FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
} as const;

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
    const response = await fetch(url, { headers: TEZARA_FETCH_HEADERS });

    if (!response.ok) {
      const durationMs = performance.now() - startTime;
      logger?.warn("search_filtered", {
        service: "tezara",
        filePath: "src/lib/tezara.ts",
        step: "page_search",
        durationMs,
        data: { query, page, status: response.status },
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
 *
 * @param id - The thesis ID.
 * @param logger - Optional Logger instance.
 * @returns Thesis details object, or null if fetching fails or metadata is completely unavailable.
 */
export async function fetchThesisDetails(
  id: number,
  logger?: Logger,
): Promise<TezaraThesisDetails | null> {
  const startTime = performance.now();
  try {
    const url = `https://tezara.org/theses/${id}`;
    const response = await fetch(url, { headers: TEZARA_FETCH_HEADERS });

    if (!response.ok) {
      const durationMs = performance.now() - startTime;
      logger?.warn("search_filtered", {
        service: "tezara",
        filePath: "src/lib/tezara.ts",
        step: "fetch_details",
        durationMs,
        data: { thesisId: id, status: response.status },
      });
      return null;
    }

    const html = await response.text();
    const details = parseTezaraDetails(html, logger);

    if (!details) {
      const durationMs = performance.now() - startTime;
      logger?.warn("search_empty", {
        service: "tezara",
        filePath: "src/lib/tezara.ts",
        step: "fetch_details",
        durationMs,
        data: {
          thesisId: id,
          reason: "Thesis metadata not found in response",
        },
      });
      return null;
    }

    return details;
  } catch (err) {
    const durationMs = performance.now() - startTime;
    logger?.error("search_filtered", {
      service: "tezara",
      filePath: "src/lib/tezara.ts",
      step: "fetch_details",
      durationMs,
      data: { thesisId: id },
      error: err,
    });
    return null;
  }
}
