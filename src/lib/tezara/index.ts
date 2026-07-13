import type { Logger } from "../logger";
import type { TezaraThesisSummary, TezaraThesisDetails } from "../types";
import { parseTezaraDetails, parseTezaraSearchResults } from "./parser";
import { enqueueTezaraFetch } from "./queue";

/**
 * Executes a search for a single page of thesis results from Tezara.
 * Makes a single request through the pipeline queue — retry logic is handled upstream.
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
    const response = await enqueueTezaraFetch(url, logger);

    if (!response || !response.ok) {
      const durationMs = performance.now() - startTime;
      logger?.warn("search_filtered", {
        service: "tezara",
        filePath: "src/lib/tezara/index.ts",
        step: "page_search",
        durationMs,
        data: { query, page, status: response?.status ?? "no_response" },
      });
      return [];
    }

    const html = await response.text();
    const results = parseTezaraSearchResults(html, logger);
    const durationMs = performance.now() - startTime;

    if (results.length === 0) {
      logger?.warn("search_empty", {
        service: "tezara",
        filePath: "src/lib/tezara/index.ts",
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
      filePath: "src/lib/tezara/index.ts",
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
 * Makes a single request through the pipeline queue — retry logic is handled upstream.
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
    const response = await enqueueTezaraFetch(url, logger);

    if (!response || !response.ok) {
      const durationMs = performance.now() - startTime;
      logger?.warn("search_filtered", {
        service: "tezara",
        filePath: "src/lib/tezara/index.ts",
        step: "fetch_details",
        durationMs,
        data: {
          thesisId: summary.id,
          status: response?.status ?? "no_response",
        },
        error: `[ID: ${summary.id}] fetch_details failed for thesis ${summary.id}`,
      });
      return null;
    }

    const html = await response.text();
    const partialDetails = parseTezaraDetails(html, summary.id, logger);

    if (!partialDetails) {
      const durationMs = performance.now() - startTime;
      logger?.warn("search_empty", {
        service: "tezara",
        filePath: "src/lib/tezara/index.ts",
        step: "fetch_details",
        durationMs,
        data: {
          thesisId: summary.id,
          reason: "Thesis metadata not found in response",
        },
        error: `[ID: ${summary.id}] parseTezaraDetails returned null for thesis ${summary.id}`,
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
      filePath: "src/lib/tezara/index.ts",
      step: "fetch_details",
      durationMs,
      data: { thesisId: summary.id },
      error: `[ID: ${summary.id}] ${err instanceof Error ? err.message : String(err)}`,
    });
    return null;
  }
}
