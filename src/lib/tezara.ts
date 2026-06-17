import type { Logger } from "./logger";
import type { TezaraThesisSummary, TezaraThesisDetails } from "./types";
import {
  extractRscTexts,
  extractJsonObjects,
  parseRscTheses,
  findThesisObjRecursively,
} from "./tezara-parser";

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

  logger?.info("search_start", {
    service: "tezara",
    step: "page_search",
    data: { query, page, advanced },
  });

  try {
    const url = `https://tezara.org/search?q=${encodeURIComponent(query)}&page=${page}${advanced ? "&advanced=true" : ""}&_rsc=vusbg`;
    const response = await fetch(url, {
      headers: {
        rsc: "1",
        accept: "text/x-component",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

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

    const text = await response.text();
    const results = parseRscTheses(text);
    const durationMs = performance.now() - startTime;

    if (results.length === 0) {
      logger?.warn("search_empty", {
        service: "tezara",
        filePath: "src/lib/tezara.ts",
        step: "page_search",
        durationMs,
        data: { query, page },
      });
    } else {
      logger?.info("search_success", {
        service: "tezara",
        step: "page_search",
        durationMs,
        data: { query, page, resultCount: results.length },
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
  logger?.info("search_start", {
    service: "tezara",
    step: "bulk_search",
    data: { query, advanced },
  });

  const page1Results = await searchTezaraPage(query, 1, logger, advanced);

  logger?.info("search_success", {
    service: "tezara",
    step: "bulk_search",
    data: { query, totalResults: page1Results.length },
  });

  return page1Results;
}

/**
 * Fetches details of a single thesis from Tezara by ID.
 * Resolves the abstract from references if needed, falling back to empty string if missing.
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

  logger?.info("search_start", {
    service: "tezara",
    step: "fetch_details",
    data: { thesisId: id },
  });

  try {
    const url = `https://tezara.org/theses/${id}?_rsc=vusbg`;
    const response = await fetch(url, {
      headers: {
        rsc: "1",
        accept: "text/x-component",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

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

    const text = await response.text();
    const refMap = extractRscTexts(text);

    // Extract YÖK PDF direct link key URL if present in response
    const pdfMatch = text.match(
      /https:\/\/tez\.yok\.gov\.tr\/UlusalTezMerkezi\/TezGoster\?key=[a-zA-Z0-9_\-]+/,
    );
    const yokPdfUrl = pdfMatch ? pdfMatch[0] : undefined;

    let thesisObj = null;
    const lines = text.split("\n");

    for (const line of lines) {
      try {
        const jsonObjects = extractJsonObjects(line);
        for (const obj of jsonObjects) {
          const found = findThesisObjRecursively(obj);
          if (found) {
            thesisObj = found;
            break;
          }
        }
        if (thesisObj) {
          break;
        }
      } catch (err) {
        void err;
      }
    }

    if (!thesisObj) {
      const durationMs = performance.now() - startTime;
      logger?.warn("search_empty", {
        service: "tezara",
        filePath: "src/lib/tezara.ts",
        step: "fetch_details",
        durationMs,
        data: { thesisId: id, reason: "Thesis metadata not found in response" },
      });
      return null;
    }

    let abstract = "";
    const originalAbs = thesisObj.abstract_original;
    const translatedAbs = thesisObj.abstract_translated;

    if (typeof originalAbs === "string" && originalAbs) {
      if (originalAbs.startsWith("$")) {
        const refId = originalAbs.substring(1);
        abstract = refMap[refId] || "";
      } else {
        abstract = originalAbs;
      }
    }

    if (!abstract && typeof translatedAbs === "string" && translatedAbs) {
      if (translatedAbs.startsWith("$")) {
        const refId = translatedAbs.substring(1);
        abstract = refMap[refId] || "";
      } else {
        abstract = translatedAbs;
      }
    }

    const durationMs = performance.now() - startTime;
    logger?.info("search_success", {
      service: "tezara",
      step: "fetch_details",
      durationMs,
      data: {
        thesisId: id,
        title: thesisObj.title_original || thesisObj.title_translated,
      },
    });

    return {
      id: Number(thesisObj.id ?? id),
      title: String(
        thesisObj.title_original ?? thesisObj.title_translated ?? "",
      ),
      author: String(thesisObj.author ?? ""),
      university: String(thesisObj.university ?? ""),
      year: Number(thesisObj.year ?? 0),
      thesisType: String(thesisObj.thesis_type ?? thesisObj.thesisType ?? ""),
      department: String(thesisObj.department ?? ""),
      abstract,
      yokPdfUrl,
    };
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
