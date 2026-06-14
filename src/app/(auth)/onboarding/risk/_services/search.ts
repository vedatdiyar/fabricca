import { ThinkingLevel } from "@google/genai";
import { tavilySearch } from "@/lib/tavily";
import { searchTezara } from "@/lib/tezara";
import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import type {
  TezaraThesisSummary,
  TavilyEvaluationResponse,
} from "@/lib/types";
import {
  tavilyEvaluationSchema,
  TAVILY_EVAL_SYSTEM_INSTRUCTION,
  buildTavilyEvalPrompt,
} from "@/lib/prompts";

/**
 * Runs Tavily and Tezara queries in parallel.
 *
 * @param tavilyQueries - List of Tavily search queries.
 * @param tezaraQueries - List of Tezara search queries.
 * @param log - The logger instance.
 * @returns Combined results of both searches.
 */
export async function executeParallelSearch(
  tavilyQueries: string[],
  tezaraQueries: string[],
  log: Logger,
): Promise<{
  tavilySearchResults: {
    query: string;
    results: { title: string; url: string; content: string }[];
  }[];
  tezaraSearchResults: TezaraThesisSummary[][];
}> {
  log.info("flow_start", {
    service: "originality",
    step: "parallel_search",
    data: {
      tavilyQueries,
      tezaraQueries,
    },
  });

  const tavilyPromises = tavilyQueries.map(async (query) => {
    try {
      const res = await tavilySearch(query, log);
      return { query, results: res.results };
    } catch (err) {
      log.error("search_filtered", {
        service: "tavily",
        data: { query },
        error: err,
      });
      return { query, results: [] };
    }
  });

  const tezaraPromises = tezaraQueries.map(async (query) => {
    try {
      return await searchTezara(query, log, true);
    } catch (err) {
      log.error("search_filtered", {
        service: "tezara",
        data: { query },
        error: err,
      });
      return [];
    }
  });

  const [tavilySearchResults, tezaraSearchResults] = await Promise.all([
    Promise.all(tavilyPromises),
    Promise.all(tezaraPromises),
  ]);

  return {
    tavilySearchResults,
    tezaraSearchResults,
  };
}

export interface EvaluateTavilyParams {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
}

/**
 * Evaluates Tavily verification results using Gemini.
 *
 * @param params - The thesis matrix parameters.
 * @param tavilySearchResults - Factual search results from Tavily.
 * @param log - The logger instance.
 * @returns The structured evaluation response with briefing note.
 */
export async function evaluateTavilyResults(
  params: EvaluateTavilyParams,
  tavilySearchResults: {
    query: string;
    results: { title: string; url: string; content: string }[];
  }[],
  log: Logger,
): Promise<TavilyEvaluationResponse> {
  log.info("ai_request_start", {
    service: "gemini",
    step: "evaluate_tavily",
  });

  const tavilyResultsFormatted = tavilySearchResults
    .map((item) => {
      const resultsSnippet = item.results
        .map(
          (r) => `- Başlık: ${r.title}\n  URL: ${r.url}\n  Özet: ${r.content}`,
        )
        .join("\n");
      return `Sorgu: "${item.query}"\nBulunan Sonuçlar:\n${resultsSnippet}`;
    })
    .join("\n\n");

  const tavilyEvaluation =
    await generateStructuredContent<TavilyEvaluationResponse>(
      "gemini-3.1-flash-lite",
      TAVILY_EVAL_SYSTEM_INSTRUCTION,
      buildTavilyEvalPrompt({
        ...params,
        tavilyResultsFormatted,
      }),
      tavilyEvaluationSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    );

  const safeFactItems = Array.isArray(tavilyEvaluation?.items)
    ? tavilyEvaluation.items
    : [];

  log.info("ai_request_success", {
    service: "gemini",
    step: "evaluate_tavily",
    data: { factCount: safeFactItems.length },
  });

  return {
    items: safeFactItems,
    briefingNote:
      tavilyEvaluation?.briefingNote || "Maddi doğrulama analizi tamamlandı.",
  };
}
