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
  buildTavilyEvalSystemInstruction,
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
    results: { title: string; url: string; content: string; score: number }[];
  }[];
  tezaraSearchResults: TezaraThesisSummary[][];
}> {
  const startTime = performance.now();
  log.info("originality_search_parallel_start", {
    service: "originality",
    data: {
      count: tavilyQueries.length + tezaraQueries.length,
      tavilyQueryCount: tavilyQueries.length,
      tezaraQueryCount: tezaraQueries.length,
    },
  });

  try {
    const tavilyPromises = tavilyQueries.map(async (query) => {
      try {
        const res = await tavilySearch(query, log);
        return { query, results: res.results };
      } catch (err) {
        log.error("originality_search_tavily_failed", {
          service: "originality",
          error: err,
          data: { query, context: `Sorgu: ${query}` },
        });
        return { query, results: [] };
      }
    });

    const tezaraSearchResults = await Promise.all(
      tezaraQueries.map(async (query) => {
        try {
          return await searchTezara(query, log, true);
        } catch (err) {
          log.error("originality_search_tezara_failed", {
            service: "originality",
            error: err,
            data: { query, context: `Sorgu: ${query}` },
          });
          return [];
        }
      }),
    );

    const tavilySearchResults = await Promise.all(tavilyPromises);

    const tavilyResultCount = tavilySearchResults.reduce(
      (sum, item) => sum + item.results.length,
      0,
    );
    const tezaraResultCount = tezaraSearchResults.reduce(
      (sum, list) => sum + list.length,
      0,
    );
    const durationMs = performance.now() - startTime;
    log.info("originality_search_parallel_success", {
      service: "originality",
      durationMs,
      data: {
        resultCount: tavilyResultCount + tezaraResultCount,
      },
    });

    return {
      tavilySearchResults,
      tezaraSearchResults,
    };
  } catch (err) {
    log.error("originality_search_parallel_failed", {
      service: "originality",
      error: err,
    });
    throw err;
  }
}

export interface EvaluateTavilyParams {
  studyTitle: string;
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
    results: { title: string; url: string; content: string; score: number }[];
  }[],
  log: Logger,
): Promise<TavilyEvaluationResponse> {
  const startTime = performance.now();
  log.info("originality_search_tavily_eval_start", {
    service: "originality",
    data: { context: params.studyTitle },
  });

  try {
    const tavilyResultsFormatted = tavilySearchResults
      .map((item) => {
        const resultsSnippet = item.results
          .filter((r) => r.score > 0.6)
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
        buildTavilyEvalSystemInstruction(),
        buildTavilyEvalPrompt({
          studyTitle: params.studyTitle,
          tavilyResultsFormatted,
        }),
        tavilyEvaluationSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          temperature: 1.0,
          seed: 42,
        },
      );

    const safeFactItems = Array.isArray(tavilyEvaluation?.items)
      ? tavilyEvaluation.items
      : [];

    const durationMs = performance.now() - startTime;
    const tokens = log.lastTokens || { input: 0, output: 0 };

    log.info("originality_search_tavily_eval_success", {
      service: "originality",
      durationMs,
      tokens: { input: tokens.input ?? 0, output: tokens.output ?? 0 },
      data: {
        resultCount: safeFactItems.length,
        context: params.studyTitle,
      },
    });

    return {
      items: safeFactItems,
      briefingNote:
        tavilyEvaluation?.briefingNote || "Maddi doğrulama analizi tamamlandı.",
    };
  } catch (err) {
    log.error("originality_search_tavily_eval_failed", {
      service: "originality",
      error: err,
      data: { context: params.studyTitle },
    });
    throw err;
  }
}
