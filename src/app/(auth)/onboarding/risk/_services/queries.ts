import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import type { QueryExtractionResponse } from "@/lib/types";
import {
  queryExtractionSchema,
  QUERY_EXTRACTION_SYSTEM_INSTRUCTION,
  buildQueryPrompt,
} from "@/lib/prompts";

/**
 * Parameter interface for query extraction function.
 */
export interface ExtractQueriesParams {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
}

/**
 * Extracts factual Turkish search queries for Tavily and academic English queries for Tezara
 * using Gemini based on the target thesis matrix.
 *
 * @param params - The thesis matrix parameters.
 * @param log - The logger instance.
 * @returns An object containing arrays of Tavily queries and Tezara queries.
 */
export async function extractQueries(
  params: ExtractQueriesParams,
  log: Logger,
): Promise<{ tavilyQueries: string[]; tezaraQueries: string[] }> {
  log.info("ai_request_start", {
    service: "gemini",
    step: "extract_queries",
  });

  const extractedQueries =
    await generateStructuredContent<QueryExtractionResponse>(
      "gemini-3.1-flash-lite",
      QUERY_EXTRACTION_SYSTEM_INSTRUCTION,
      buildQueryPrompt(params),
      queryExtractionSchema,
      log,
    );

  const safeTavilyQueries = Array.isArray(extractedQueries?.tavilyQueries)
    ? extractedQueries.tavilyQueries
    : [];

  const safeTezaraQueries = Array.isArray(extractedQueries?.tezaraQueries)
    ? extractedQueries.tezaraQueries
    : [];

  log.info("ai_request_success", {
    service: "gemini",
    step: "extract_queries",
    data: {
      tavilyQueryCount: safeTavilyQueries.length,
      tezaraQueryCount: safeTezaraQueries.length,
    },
  });

  return {
    tavilyQueries: safeTavilyQueries,
    tezaraQueries: safeTezaraQueries,
  };
}
