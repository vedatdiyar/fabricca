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

const MAX_TEZARA_CONCURRENCY = 1;

const TEZARA_MIN_SLEEP_MS = 360;
const TEZARA_MAX_SLEEP_MS = 2000;

/**
 * Runs an array of async operations with a concurrency cap.
 *
 * @param items - Items to process.
 * @param fn - Async function to apply on each item.
 * @param concurrency - Maximum number of concurrent operations.
 * @returns Array of results in original order.
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      const jitterDelay =
        TEZARA_MIN_SLEEP_MS +
        Math.floor(
          Math.random() * (TEZARA_MAX_SLEEP_MS - TEZARA_MIN_SLEEP_MS + 1),
        );
      await new Promise((resolve) => setTimeout(resolve, jitterDelay));
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}

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

    const tezaraSearchResults = await runWithConcurrencyLimit(
      tezaraQueries,
      async (query) => {
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
      },
      MAX_TEZARA_CONCURRENCY,
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
    results: { title: string; url: string; content: string }[];
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
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
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
