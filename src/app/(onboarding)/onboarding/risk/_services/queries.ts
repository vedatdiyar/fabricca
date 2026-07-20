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
      researchCore: params.researchCore,
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
          quiet: true,
        },
      );

    const turkishList = Array.isArray(keywordResult?.turkishQueries)
      ? keywordResult.turkishQueries.map((q) => q.trim()).filter(Boolean)
      : [];
    const englishList = Array.isArray(keywordResult?.englishQueries)
      ? keywordResult.englishQueries.map((q) => q.trim()).filter(Boolean)
      : [];

    const rawQueries = [...turkishList, ...englishList];

    // Filter to enforce 2-3 word limits, and allow 1-word queries only if they appear in matrixText
    const matrixText = `${params.researchCore} ${params.mainClaim}`;
    let tezaraQueries = rawQueries.filter((q) => {
      const trimmed = q.trim();
      const wordCount = trimmed.split(/\s+/).length;
      if (wordCount === 2 || wordCount === 3) {
        return true;
      }
      if (wordCount === 1) {
        // Topic-agnostic check: 1-word queries are allowed only if the word appears in the matrix text
        const word = trimmed.toLowerCase();
        const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const regex = new RegExp(
          `(?:^|[^a-zA-ZğüşıöçĞÜŞİÖÇ])(${escapedWord})(?:$|[^a-zA-ZğüşıöçĞÜŞİÖÇ])`,
          "i",
        );
        return regex.test(matrixText);
      }
      return false;
    });

    // Remove duplicates and limit to 16
    tezaraQueries = Array.from(new Set(tezaraQueries)).slice(0, 16);

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
      data: { context: params.researchCore },
    });
    log.groupEnd("originality_queries_extract", durationMs);
    throw err;
  }
}
