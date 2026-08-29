import { Logger, createFlowId } from "@/lib/logger";

/** Request options for Exa search. */
export interface ExaSearchOptions {
  /** Number of results to return (default: 5). */
  numResults?: number;
  /** Whether to extract highlights (default: true). */
  highlights?: boolean;
  /** Filter to only include specific domains (e.g., ['dergipark.org.tr']). */
  includeDomains?: string[];
  /** Filter by category (e.g., 'publication', 'news', 'company'). */
  category?: "publication" | "company" | "news" | "financial report";
}

/** Individual search result returned by Exa. */
export interface ExaSearchResult {
  id: string;
  title: string;
  url: string;
  author?: string | null;
  publishedDate?: string | null;
  highlights?: string[];
  score?: number;
}

/** Response structure from Exa search endpoint. */
interface ExaApiResponse {
  results: ExaSearchResult[];
  autopromptString?: string;
}

/**
 * Executes a neural/semantic search using Exa.ai.
 * Designed for empirical, Turkish publications (DergiPark), industry reports, and gray literature.
 *
 * @param query - Natural language search query.
 * @param options - Search configuration options.
 * @returns Array of matching results with highlights.
 */
export async function searchExa(
  query: string,
  options?: ExaSearchOptions,
): Promise<ExaSearchResult[]> {
  const log = new Logger(createFlowId());
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    log.warn("exa_search_missing_key", {
      service: "literature",
      data: { summary: "EXA_API_KEY missing" },
    });
    return [];
  }

  const numResults = options?.numResults ?? 5;
  const highlights = options?.highlights ?? true;

  try {
    return await log.time(
      "exa_search",
      async () => {
        const response = await fetch("https://api.exa.ai/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query,
            type: "auto",
            numResults,
            includeDomains: options?.includeDomains,
            category: options?.category,
            contents: {
              highlights,
            },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Exa API HTTP ${response.status}: ${errorBody}`);
        }

        const data = (await response.json()) as ExaApiResponse;
        return data.results ?? [];
      },
      { service: "literature" },
    );
  } catch {
    return [];
  }
}
