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
  const startTime = performance.now();
  log.info({
    step: "parallel_search",
    status: "START",
    tavilyQueryCount: tavilyQueries.length,
    tezaraQueryCount: tezaraQueries.length,
  });

  try {
    const tavilyPromises = tavilyQueries.map(async (query) => {
      try {
        const res = await tavilySearch(query, log);
        return { query, results: res.results };
      } catch (err) {
        log.error({
          step: "tavily_search",
          status: "FAILED",
          diagnostics: {
            errorCode: "TAVILY_SEARCH_ERROR",
            query,
            message: err instanceof Error ? err.message : String(err),
          },
        });
        return { query, results: [] };
      }
    });

    const tezaraPromises = tezaraQueries.map(async (query) => {
      try {
        return await searchTezara(query, log, true);
      } catch (err) {
        log.error({
          step: "tezara_search",
          status: "FAILED",
          diagnostics: {
            errorCode: "TEZARA_SEARCH_ERROR",
            query,
            message: err instanceof Error ? err.message : String(err),
          },
        });
        return [];
      }
    });

    const [tavilySearchResults, tezaraSearchResults] = await Promise.all([
      Promise.all(tavilyPromises),
      Promise.all(tezaraPromises),
    ]);

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";
    log.info({
      step: "parallel_search",
      status: "SUCCESS",
      metrics: {
        duration,
        outputRows: tavilySearchResults.length + tezaraSearchResults.length,
      },
    });

    return {
      tavilySearchResults,
      tezaraSearchResults,
    };
  } catch (err) {
    log.error({
      step: "parallel_search",
      status: "FAILED",
      diagnostics: {
        errorCode: "SEARCH_EXECUTION_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
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
  const startTime = performance.now();
  log.info({
    step: "evaluate_tavily",
    status: "START",
    studyTitle: params.studyTitle,
  });

  try {
    const tavilyResultsFormatted = tavilySearchResults
      .map((item) => {
        const resultsSnippet = item.results
          .map(
            (r) =>
              `- Başlık: ${r.title}\n  URL: ${r.url}\n  Özet: ${r.content}`,
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

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";
    const tokens = log.lastTokens || { input: 0, output: 0 };

    log.info({
      step: "evaluate_tavily",
      status: "SUCCESS",
      metrics: {
        duration,
        tokens: {
          prompt: tokens.input ?? 0,
          completion: tokens.output ?? 0,
        },
        outputRows: safeFactItems.length,
      },
    });

    return {
      items: safeFactItems,
      briefingNote:
        tavilyEvaluation?.briefingNote || "Maddi doğrulama analizi tamamlandı.",
    };
  } catch (err) {
    log.error({
      step: "evaluate_tavily",
      status: "FAILED",
      diagnostics: {
        errorCode: "GEMINI_EVALUATION_ERROR",
        message: err instanceof Error ? err.message : String(err),
        model: "gemini-3.1-flash-lite",
      },
    });
    throw err;
  }
}
