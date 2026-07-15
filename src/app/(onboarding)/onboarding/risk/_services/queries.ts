import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/services/gemini";
import { GEMINI_MODEL, GEMINI_TEMPERATURE, GEMINI_SEED } from "@/lib/constants";
import type { Logger } from "@/lib/logger";
import type { ThesisMatrix } from "@/lib/types";
import {
  litKeywordExtractionSchema,
  buildLitKeywordExtractionSystemInstruction,
  buildLitKeywordPrompt,
} from "@/lib/prompts";

interface LitKeywordExtractionResponse {
  turkishQueries: string[];
  englishQueries: string[];
}

/**
 * Parameter interface for query extraction function.
 */
export type ExtractQueriesParams = ThesisMatrix;

/**
 * Extracts academic queries for Tezara using Gemini based on the
 * target thesis matrix.
 *
 * @param params - The thesis matrix parameters.
 * @param log - The logger instance.
 * @returns An object containing arrays of Tezara queries.
 */
export async function extractQueries(
  params: ExtractQueriesParams,
  log: Logger,
): Promise<{
  tezaraQueries: string[];
}> {
  log.file("queries.ts:32");
  const startTime = performance.now();
  log.groupStart("originality_queries_extract");

  try {
    const geminiInput = {
      mainActors: params.mainActors,
      researchFocus: params.researchFocus,
      mainClaim: params.mainClaim,
    };

    const keywordPrompt = buildLitKeywordPrompt(geminiInput);

    log.prompt("gemini-3.1-flash-lite (keywords)", keywordPrompt);

    const keywordResult =
      await generateStructuredContent<LitKeywordExtractionResponse>(
        GEMINI_MODEL,
        buildLitKeywordExtractionSystemInstruction(),
        keywordPrompt,
        litKeywordExtractionSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          temperature: GEMINI_TEMPERATURE,
          seed: GEMINI_SEED,
          thesisMatrix: geminiInput,
          payloadStage: "keywords",
        },
      );

    const turkishList = Array.isArray(keywordResult?.turkishQueries)
      ? keywordResult.turkishQueries.map((q) => q.trim()).filter(Boolean)
      : [];
    const englishList = Array.isArray(keywordResult?.englishQueries)
      ? keywordResult.englishQueries.map((q) => q.trim()).filter(Boolean)
      : [];

    const rawQueries = [...turkishList, ...englishList];

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
      const titleWords = params.researchFocus
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

    const durationMs = performance.now() - startTime;
    log.groupEnd("originality_queries_extract", durationMs);

    return {
      tezaraQueries,
    };
  } catch (err) {
    const durationMs = performance.now() - startTime;
    log.error("originality_queries_extract_failed", {
      service: "originality",
      error: err,
      durationMs,
      data: { context: params.researchFocus },
    });
    log.groupEnd("originality_queries_extract", durationMs);
    throw err;
  }
}
