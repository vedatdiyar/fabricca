import type { Logger } from "./logger";

/**
 * Tezara Thesis Summary Search Result.
 */
export interface TezaraThesisSummary {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
}

/**
 * Tezara Thesis Details Interface.
 */
export interface TezaraThesisDetails {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  abstract: string;
}

/**
 * Safely extracts all JSON objects found within a given string.
 * Uses a brace-counting scanner that respects string literal boundaries and escape characters.
 *
 * @param text - The raw string input to search.
 * @returns An array of parsed JSON objects.
 */
function extractJsonObjects(text: string): any[] {
  const jsonObjects: any[] = [];
  if (typeof text !== "string") {
    return jsonObjects;
  }

  let braceCount = 0;
  let startIdx = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      if (inString) {
        escapeNext = true;
      }
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        if (braceCount === 0) {
          startIdx = i;
        }
        braceCount++;
      } else if (char === "}") {
        if (braceCount > 0) {
          braceCount--;
          if (braceCount === 0 && startIdx !== -1) {
            const candidate = text.substring(startIdx, i + 1);
            try {
              const parsed = JSON.parse(candidate);
              if (parsed && typeof parsed === "object") {
                jsonObjects.push(parsed);
              }
            } catch (err) {
              void err;
            }
          }
        }
      }
    }
  }

  return jsonObjects;
}

/**
 * Extracts RSC stream text fragments mapped by their reference key.
 *
 * @param text - The raw RSC response text.
 * @returns A mapping of reference IDs to their resolved text contents.
 */
export function extractRscTexts(text: string): Record<string, string> {
  const refMap: Record<string, string> = {};
  if (typeof text !== "string") {
    return refMap;
  }

  const lines = text.split("\n");
  for (const line of lines) {
    try {
      const trimmedLine = line.trim();
      const colonIdx = trimmedLine.indexOf(":");
      if (colonIdx === -1) {
        continue;
      }

      const key = trimmedLine.substring(0, colonIdx).trim();
      // Ensure the key looks like a valid alphanumeric reference identifier
      if (!/^[a-zA-Z0-9]+$/.test(key)) {
        continue;
      }

      let content = trimmedLine.substring(colonIdx + 1);

      // If the content starts with a type prefix (like T12, etc.) followed by a comma
      // e.g. "T12,Özet" or "T12,\"Özet\""
      if (/^[a-zA-Z][a-zA-Z0-9]*,/.test(content)) {
        const commaIdx = content.indexOf(",");
        if (commaIdx !== -1) {
          content = content.substring(commaIdx + 1);
        }
      }

      // If it is wrapped in quotes, try to parse it as a JSON string to handle unescaping
      if (content.startsWith('"') && content.endsWith('"')) {
        try {
          const parsed = JSON.parse(content);
          if (typeof parsed === "string") {
            refMap[key] = parsed;
            continue;
          }
        } catch (err) {
          void err;
        }
      }

      // Fallback: save content as is, trimmed
      refMap[key] = content.trim();
    } catch (err) {
      void err;
    }
  }

  return refMap;
}

/**
 * Recursively searches any value to find and extract objects that match the thesis summary structure.
 *
 * @param val - The value to scan.
 * @param results - The accumulator array of thesis summaries.
 */
function findThesesRecursively(val: any, results: TezaraThesisSummary[]): void {
  if (!val || typeof val !== "object") {
    return;
  }

  if (Array.isArray(val)) {
    for (const item of val) {
      findThesesRecursively(item, results);
    }
    return;
  }

  // If the object looks like a thesis summary (must have title and some identifier or author)
  if (
    (typeof val.title_original === "string" ||
      typeof val.title_translated === "string") &&
    (val.id !== undefined || val.author !== undefined)
  ) {
    const id = Number(val.id ?? 0);
    const title = String(val.title_original ?? val.title_translated ?? "");
    const author = String(val.author ?? "");
    const university = String(val.university ?? "");
    const year = Number(val.year ?? 0);
    const thesisType = String(val.thesis_type ?? val.thesisType ?? "");
    const department = String(val.department ?? "");

    // Avoid duplicates
    if (!results.some((r) => r.id === id)) {
      results.push({
        id,
        title,
        author,
        university,
        year,
        thesisType,
        department,
      });
    }
  }

  // Recurse into all properties
  const keys = Object.keys(val);
  for (const key of keys) {
    try {
      findThesesRecursively(val[key], results);
    } catch (err) {
      void err;
    }
  }
}

/**
 * Parses the thesis search results from raw RSC stream text response.
 *
 * @param text - The raw RSC response text.
 * @returns A list of parsed thesis summary objects.
 */
export function parseRscTheses(text: string): TezaraThesisSummary[] {
  const results: TezaraThesisSummary[] = [];
  if (typeof text !== "string") {
    return results;
  }

  const lines = text.split("\n");
  for (const line of lines) {
    try {
      const jsonObjects = extractJsonObjects(line);
      for (const obj of jsonObjects) {
        if (!obj || typeof obj !== "object") {
          continue;
        }

        // Navigate the standard Next.js query cache state structure safely
        const queries = obj?.state?.queries || obj?.queries || [];
        if (Array.isArray(queries)) {
          for (const q of queries) {
            if (
              q &&
              Array.isArray(q.queryKey) &&
              q.queryKey[0] === "searchTheses"
            ) {
              const hits =
                q.state?.data?.json?.hits ||
                q.data?.json?.hits ||
                q.state?.data?.hits ||
                q.data?.hits ||
                [];
              if (Array.isArray(hits)) {
                for (const hit of hits) {
                  if (hit && typeof hit === "object") {
                    const id = Number(hit.id ?? 0);
                    const title = String(
                      hit.title_original ?? hit.title_translated ?? "",
                    );
                    const author = String(hit.author ?? "");
                    const university = String(hit.university ?? "");
                    const year = Number(hit.year ?? 0);
                    const thesisType = String(
                      hit.thesis_type ?? hit.thesisType ?? "",
                    );
                    const department = String(hit.department ?? "");

                    if (!results.some((r) => r.id === id)) {
                      results.push({
                        id,
                        title,
                        author,
                        university,
                        year,
                        thesisType,
                        department,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (err) {
      void err;
    }
  }

  // Fallback: If no results were found via the structured path, search recursively
  if (results.length === 0) {
    for (const line of lines) {
      try {
        const jsonObjects = extractJsonObjects(line);
        for (const obj of jsonObjects) {
          findThesesRecursively(obj, results);
        }
      } catch (err) {
        void err;
      }
    }
  }

  return results;
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
      step: "page_search",
      durationMs,
      data: { query, page },
      error: err,
    });
    return [];
  }
}

/**
 * Searches Tezara with up to 3 pages of results based on pagination rules.
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

  if (page1Results.length !== 20) {
    logger?.info("search_success", {
      service: "tezara",
      step: "bulk_search",
      data: { query, totalResults: page1Results.length },
    });
    return page1Results;
  }

  const page2Results = await searchTezaraPage(query, 2, logger, advanced);

  let page3Results: TezaraThesisSummary[] = [];
  if (page2Results.length === 20) {
    page3Results = await searchTezaraPage(query, 3, logger, advanced);
  }

  // Combine and deduplicate by ID just in case
  const combined = [...page1Results, ...page2Results, ...page3Results];
  const uniqueResults: TezaraThesisSummary[] = [];
  const seenIds = new Set<number>();

  for (const item of combined) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      uniqueResults.push(item);
    }
  }

  const allResults = uniqueResults.slice(0, 60);

  logger?.info("search_success", {
    service: "tezara",
    step: "bulk_search",
    data: { query, totalResults: allResults.length },
  });

  return allResults;
}

/**
 * Recursively searches a JSON structure to find the thesis object details.
 *
 * @param val - The value to scan.
 * @returns The found thesis object or null.
 */
function findThesisObjRecursively(val: any): Record<string, any> | null {
  if (!val || typeof val !== "object") {
    return null;
  }

  // Check if the object contains a nested 'thesis' object with academic fields
  if (val.thesis && typeof val.thesis === "object") {
    const nested = val.thesis;
    if (
      nested.title_original !== undefined ||
      nested.title_translated !== undefined ||
      nested.author !== undefined
    ) {
      return nested;
    }
  }

  // Check if the object itself has title_original / title_translated and author
  if (
    (val.title_original !== undefined || val.title_translated !== undefined) &&
    (val.author !== undefined || val.university !== undefined)
  ) {
    return val;
  }

  // Recurse into all keys
  const keys = Object.keys(val);
  for (const key of keys) {
    try {
      const result = findThesisObjRecursively(val[key]);
      if (result) {
        return result;
      }
    } catch (err) {
      void err;
    }
  }

  return null;
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
        step: "fetch_details",
        durationMs,
        data: { thesisId: id, status: response.status },
      });
      return null;
    }

    const text = await response.text();
    const refMap = extractRscTexts(text);

    let thesisObj: Record<string, any> | null = null;
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
    };
  } catch (err) {
    const durationMs = performance.now() - startTime;
    logger?.error("search_filtered", {
      service: "tezara",
      step: "fetch_details",
      durationMs,
      data: { thesisId: id },
      error: err,
    });
    return null;
  }
}
