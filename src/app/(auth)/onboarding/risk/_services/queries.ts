import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import {
  factQueryExtractionSchema,
  buildFactQueryExtractionSystemInstruction,
  buildFactQueryPrompt,
  litKeywordExtractionSchema,
  buildLitKeywordExtractionSystemInstruction,
  buildLitKeywordPrompt,
} from "@/lib/prompts";

/**
 * Internal response type for the fact-oriented Tavily query extraction prompt.
 */
interface FactQueryExtractionResponse {
  tavilyQueries: string[];
}

interface LitKeywordExtractionResponse {
  queries: string[];
}

/**
 * Parameter interface for query extraction function.
 */
export interface ExtractQueriesParams {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
}

/**
 * Extracts factual Turkish search queries for Tavily and academic English queries for Tezara
 * using Gemini based on the target thesis matrix. Runs two prompts sequentially to
 * guarantee a deterministic KV-cache session order between runs:
 *   - fact-query-extraction: produces only concrete empirical Tavily queries (always first)
 *   - lit-keyword-extraction: produces English lemma queries for the Tezara engine (always second)
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
  log.file("queries.ts:32");
  const startTime = performance.now();
  log.info("originality_queries_extract_start", {
    service: "originality",
    data: { context: params.studyTitle },
  });

  try {
    const geminiInput = {
      studyTitle: params.studyTitle,
      researchQuestion: params.researchQuestion,
      mainClaim: params.mainClaim,
      theoreticalFramework: params.theoreticalFramework,
      methodology: params.methodology,
      researchScope: params.researchScope,
    };

    const factPrompt = buildFactQueryPrompt(geminiInput);
    const keywordPrompt = buildLitKeywordPrompt(geminiInput);

    log.prompt("gemini-3.1-flash-lite (fact queries)", factPrompt);
    log.prompt("gemini-3.1-flash-lite (keywords)", keywordPrompt);

    // Run both extraction prompts sequentially (factResult ALWAYS first) for
    // deterministic KV-cache session order between runs.
    const factResult =
      await generateStructuredContent<FactQueryExtractionResponse>(
        "gemini-3.1-flash-lite",
        buildFactQueryExtractionSystemInstruction(),
        factPrompt,
        factQueryExtractionSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          temperature: 1.0,
          seed: 42,
        },
      );

    const keywordResult =
      await generateStructuredContent<LitKeywordExtractionResponse>(
        "gemini-3.1-flash-lite",
        buildLitKeywordExtractionSystemInstruction(),
        keywordPrompt,
        litKeywordExtractionSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          temperature: 1.0,
          seed: 42,
        },
      );

    const rawTavilyQueries = Array.isArray(factResult?.tavilyQueries)
      ? factResult.tavilyQueries
      : [];

    // Fallback: ensure at least 1 Tavily query exists (4th shield against empty sets)
    const finalTavilyQueries =
      rawTavilyQueries.length === 0
        ? [`${params.studyTitle} research verification`]
        : rawTavilyQueries;

    const rawQueries = Array.isArray(keywordResult?.queries)
      ? keywordResult.queries.map((q) => q.trim()).filter(Boolean)
      : [];

    // Ensure we have at least 6 queries, max 8 (as per prompt/guidelines)
    let tezaraQueries = [...rawQueries];
    if (tezaraQueries.length < 6) {
      const stopWords = new Set([
        "ve",
        "ile",
        "bir",
        "in",
        "the",
        "on",
        "of",
        "and",
        "or",
        "a",
        "an",
        "de",
        "da",
        "ki",
        "göre",
        "üzerine",
        "hakkında",
        "ilişkin",
        "analizi",
        "incelemesi",
        "değerlendirilmesi",
        "boyutu",
        "dönemi",
        "yılları",
        "arasında",
        "döneminde",
        "yaklaşımı",
        "kuramı",
        "çalışması",
        "özelinde",
      ]);
      const titleWords = params.studyTitle
        .toLowerCase()
        .replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ\s]/g, "")
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 2 && !stopWords.has(w));

      // Generate 2-word combinations from title words
      for (
        let i = 0;
        i < titleWords.length - 1 && tezaraQueries.length < 6;
        i++
      ) {
        const queryCandidate = `${titleWords[i]} ${titleWords[i + 1]}`;
        if (!tezaraQueries.includes(queryCandidate)) {
          tezaraQueries.push(queryCandidate);
        }
      }

      // If still less than 6, add single words
      for (let i = 0; i < titleWords.length && tezaraQueries.length < 6; i++) {
        if (!tezaraQueries.includes(titleWords[i])) {
          tezaraQueries.push(titleWords[i]);
        }
      }
    }
    tezaraQueries = tezaraQueries.slice(0, 8);

    // Signature compatibility: map first word of each query as keywords
    const keywords = tezaraQueries
      .map((q) => q.split(" ")[0].trim())
      .filter(Boolean);

    const durationMs = performance.now() - startTime;
    const tokens = log.lastTokens ?? { input: 0, output: 0 };

    log.preview("Extracted Tavily Queries", finalTavilyQueries);

    log.info("originality_queries_extract_success", {
      service: "originality",
      durationMs,
      tokens: { input: tokens.input ?? 0, output: tokens.output ?? 0 },
      data: {
        count: finalTavilyQueries.length + tezaraQueries.length,
        context: params.studyTitle,
      },
    });

    return {
      tavilyQueries: finalTavilyQueries,
      tezaraQueries,
      keywords,
    };
  } catch (err) {
    log.error("originality_queries_extract_failed", {
      service: "originality",
      error: err,
      data: { context: params.studyTitle },
    });
    throw err;
  }
}
