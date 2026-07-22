import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/services/gemini";
import { FLASH_LITE_31, GEMINI_SEED } from "@/lib/constants";
import type { Logger } from "@/lib/logger";
import type { ThesisMatrix } from "@/lib/types";
import {
  retrievalParamsSchema,
  buildRetrievalParamsSystemInstruction,
  buildRetrievalParamsPrompt,
  type RetrievalParamsResponse,
} from "@/lib/prompts";

/**
 * Parameter interface for query extraction function.
 */
export type ExtractQueriesParams = ThesisMatrix;

/**
 * Extracts 8 dyadic academic queries for Tezara and 1-sentence Cohere semantic target
 * using Gemini based on the target thesis matrix.
 *
 * @param params - The thesis matrix parameters.
 * @param log - The logger instance.
 * @returns Object containing tezaraQueries array and cohereSemanticTarget string.
 */
export async function extractQueries(
  params: ExtractQueriesParams,
  log: Logger,
): Promise<{
  tezaraQueries: string[];
  cohereSemanticTarget: string;
}> {
  log.file("queries.ts:32");
  const startTime = performance.now();
  log.groupStart("originality_queries_extract");

  try {
    const geminiInput = {
      researchCore: params.researchCore,
      mainClaim: params.mainClaim,
    };

    const keywordPrompt = buildRetrievalParamsPrompt(geminiInput);

    log.prompt(`${FLASH_LITE_31} (keywords)`, keywordPrompt);

    const keywordResult =
      await generateStructuredContent<RetrievalParamsResponse>(
        FLASH_LITE_31,
        buildRetrievalParamsSystemInstruction(),
        keywordPrompt,
        retrievalParamsSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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

    // Filter to enforce 2-4 word limits for dyadic queries
    let tezaraQueries = rawQueries.filter((q) => {
      const trimmed = q.trim();
      const wordCount = trimmed.split(/\s+/).length;
      return wordCount >= 2 && wordCount <= 4;
    });

    // Remove duplicates and limit to 8 strict dyadic queries (4 TR + 4 EN)
    tezaraQueries = Array.from(new Set(tezaraQueries)).slice(0, 8);

    const cohereSemanticTarget =
      typeof keywordResult?.cohereSemanticTarget === "string"
        ? keywordResult.cohereSemanticTarget.trim()
        : `${params.researchCore} - ${params.targetActors}`;

    log.data("extact_queries_result", {
      tezaraQueriesCount: tezaraQueries.length,
      cohereSemanticTarget,
    });

    const durationMs = performance.now() - startTime;
    log.groupEnd("originality_queries_extract", durationMs);

    return {
      tezaraQueries,
      cohereSemanticTarget,
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
