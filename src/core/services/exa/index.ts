import { Logger, createFlowId } from "@/lib/logger";

/** Request options for Exa search. */
export interface ExaSearchOptions {
  /** Number of results to return (default: 5). */
  numResults?: number;
  /** Whether to extract highlights (default: true). */
  highlights?: boolean;
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
    log.warn("Exa.ai API key is missing. Skipping search.", {
      step: "exa_search_missing_key",
    });
    return [];
  }


  const numResults = options?.numResults ?? 5;
  const highlights = options?.highlights ?? true;

  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults,
        contents: {
          highlights,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      log.error("Exa search API request failed", {
        step: "exa_search_failed",
        data: { status: response.status, error: errorBody },
      });
      return [];
    }

    const data = (await response.json()) as ExaApiResponse;
    return data.results ?? [];
  } catch (error) {
    log.error("Unexpected error during Exa search", {
      step: "exa_search_error",
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

