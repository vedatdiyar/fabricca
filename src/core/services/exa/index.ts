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
  /** Optional logger instance for observability. */
  logger?: Logger;
  /** Whether to silence individual console logging when nested in a pipeline. */
  silent?: boolean;
  /** Optional descriptive summary tag for terminal logs. */
  summary?: string;
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
 *
 * @param query - Natural language search query.
 * @param options - Search configuration options.
 * @returns Array of matching results with highlights.
 */
export async function searchExa(
  query: string,
  options?: ExaSearchOptions,
): Promise<ExaSearchResult[]> {
  const log = options?.logger ?? new Logger(createFlowId());
  const silent = options?.silent ?? false;
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    if (!silent) {
      log.warn("exa_search_missing_key", {
        service: "literature",
        data: { summary: "EXA_API_KEY missing" },
      });
    }
    return [];
  }

  const numResults = options?.numResults ?? 5;
  const highlights = options?.highlights ?? true;

  const executeFetch = async (): Promise<ExaSearchResult[]> => {
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
  };

  try {
    if (silent) {
      return await executeFetch();
    }

    const domainSummary =
      options?.summary ||
      (options?.includeDomains?.length
        ? options.includeDomains.join(", ")
        : "web");

    return await log.time("exa_search", executeFetch, {
      service: "literature",
      data: { summary: domainSummary },
    });
  } catch {
    return [];
  }
}
