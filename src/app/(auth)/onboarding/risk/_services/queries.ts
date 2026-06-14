import { ThinkingLevel } from "@google/genai";
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
): Promise<{
  tavilyQueries: string[];
  tezaraQueries: string[];
  keywords: string[];
}> {
  const startTime = performance.now();
  log.info({
    step: "extract_queries",
    status: "START",
    studyTitle: params.studyTitle,
  });

  try {
    const extractedQueries =
      await generateStructuredContent<QueryExtractionResponse>(
        "gemini-3.1-flash-lite",
        QUERY_EXTRACTION_SYSTEM_INSTRUCTION,
        buildQueryPrompt(params),
        queryExtractionSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      );

    const safeTavilyQueries = Array.isArray(extractedQueries?.tavilyQueries)
      ? extractedQueries.tavilyQueries
      : [];

    const rawKeywords = Array.isArray(extractedQueries?.keywords)
      ? extractedQueries.keywords.map((k) => k.trim()).filter(Boolean)
      : [];

    // Pad keywords to ensure exactly 5 items
    const keywords = [...rawKeywords];
    const defaults = ["thesis", "research", "study", "analysis", "framework"];
    let defaultIdx = 0;
    while (keywords.length < 5) {
      const fallbackVal = defaults[defaultIdx % defaults.length];
      if (!keywords.includes(fallbackVal)) {
        keywords.push(fallbackVal);
      } else {
        keywords.push(`${fallbackVal}${keywords.length}`);
      }
      defaultIdx++;
    }
    const finalKeywords = keywords.slice(0, 5);

    // Dynamic combinations generator
    const tezaraQueries: string[] = [];
    const combos2 = getCombinations(finalKeywords, 2);
    const combos3 = getCombinations(finalKeywords, 3);
    tezaraQueries.push(...combos2, ...combos3);

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";
    const tokens = (log as any).lastTokens || { input: 0, output: 0 };

    log.info({
      step: "extract_queries",
      status: "SUCCESS",
      metrics: {
        duration,
        tokens: {
          prompt: tokens.input ?? 0,
          completion: tokens.output ?? 0,
        },
        outputRows: safeTavilyQueries.length + tezaraQueries.length,
      },
    });

    return {
      tavilyQueries: safeTavilyQueries,
      tezaraQueries,
      keywords: finalKeywords,
    };
  } catch (err) {
    log.error({
      step: "extract_queries",
      status: "FAILED",
      diagnostics: {
        errorCode: "GEMINI_EXTRACTION_ERROR",
        message: err instanceof Error ? err.message : String(err),
        model: "gemini-3.1-flash-lite",
      },
    });
    throw err;
  }
}

/**
 * Generates all unique combinations of a given size from an array of strings.
 * Combines words with spaces.
 *
 * @param arr - The string array pool.
 * @param size - The combination size (e.g. 2 or 3).
 * @returns Array of space-separated keyword combinations.
 */
function getCombinations(arr: string[], size: number): string[] {
  const result: string[] = [];
  function helper(start: number, path: string[]) {
    if (path.length === size) {
      result.push(path.join(" "));
      return;
    }
    for (let i = start; i < arr.length; i++) {
      helper(i + 1, [...path, arr[i]]);
    }
  }
  helper(0, []);
  return result;
}
