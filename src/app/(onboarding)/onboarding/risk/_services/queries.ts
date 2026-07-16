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

    // Filter to enforce 2-word limit: drop any query with <2 or >2 words
    let tezaraQueries = rawQueries.filter((q) => {
      const wc = q.trim().split(/\s+/).length;
      return wc === 2;
    });

    // Actor-based smart padding: if <6 queries, generate clean 2-word
    // umbrella forms from mainActors text instead of researchFocus noise
    if (tezaraQueries.length < 6) {
      const actorWords = params.mainActors
        .toLowerCase()
        .replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ\s]/g, "")
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 2)
        .filter(
          (w) =>
            ![
              "ve", "ile", "bir", "in", "the", "on", "of", "and",
              "or", "a", "an", "de", "da", "ki", "göre", "üzerine",
              "hakkında", "ilişkin", "araştırmanın", "temel", "öznesi",
            ].includes(w),
        );

      const uniqueWords = [...new Set(actorWords)];

      // Generate adjacent 2-word combos from actor text
      for (let i = 0; i < uniqueWords.length - 1 && tezaraQueries.length < 6; i++) {
        const candidate = `${uniqueWords[i]} ${uniqueWords[i + 1]}`;
        if (!tezaraQueries.includes(candidate)) {
          tezaraQueries.push(candidate);
        }
      }

      // If still <6, add single meaningful actor words as 1-word queries
      // (single words are allowed only as last-resort fallback)
      for (let i = 0; i < uniqueWords.length && tezaraQueries.length < 6; i++) {
        if (!tezaraQueries.includes(uniqueWords[i]) && !tezaraQueries.some((q) => q.includes(uniqueWords[i]))) {
          tezaraQueries.push(uniqueWords[i]);
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
