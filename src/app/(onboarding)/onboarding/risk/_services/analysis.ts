import { generateStructuredContent } from "@/lib/services/gemini";
import { GEMINI_MODEL, GEMINI_TEMPERATURE, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import { z } from "zod";
import type { Logger } from "@/lib/logger";
import type { TezaraThesisDetails } from "@/lib/types";
import {
  geminiBatchResponseSchema,
  buildAnalysisSystemInstruction,
  buildAnalysisPrompt,
} from "@/lib/prompts/originality-analysis";

// ============================================================================
// LLM Output Types — Raw classification data produced by Gemini
// ============================================================================

export interface LLMScoredItem {
  tez_id: string;
  researchFocus: 0 | 50 | 100;
  mainActors: 0 | 50 | 100;
  scopeContext: 0 | 50 | 100;
  temporalLabel: "OVERLAP" | "PAST" | "FUTURE" | "UNKNOWN";
  theoreticalFramework: 0 | 50 | 100;
  methodology: 0 | 50 | 100;
  mainClaim: 0 | 50 | 100;
}

// Zod şeması — runtime doğrulama
const llmScoredItemZodSchema = z.object({
  tez_id: z.string(),
  researchFocus: z.union([z.literal(0), z.literal(50), z.literal(100)]),
  mainActors: z.union([z.literal(0), z.literal(50), z.literal(100)]),
  scopeContext: z.union([z.literal(0), z.literal(50), z.literal(100)]),
  temporalLabel: z.enum(["OVERLAP", "PAST", "FUTURE", "UNKNOWN"]),
  theoreticalFramework: z.union([z.literal(0), z.literal(50), z.literal(100)]),
  methodology: z.union([z.literal(0), z.literal(50), z.literal(100)]),
  mainClaim: z.union([z.literal(0), z.literal(50), z.literal(100)]),
});

export const llmBatchResponseZodSchema = z.array(llmScoredItemZodSchema);

// ============================================================================
// Analysis Orchestration — LLM Batching + Result Assembly
// ============================================================================

export type AnalyzeOriginalityRiskParams = {
  mainActors: string;
  researchFocus: string;
  context: string;
  theoreticalFramework: string;
  methodology: string;
  mainClaim: string;
  selectedTheses: TezaraThesisDetails[];
};

// ============================================================================
// analyzeOriginalityRisk — LLM Batching + Validation
// ============================================================================

/**
 * Compares selected candidate theses against the user's thesis matrix
 * using Gemini in batches of 3. The LLM produces categorical scores
 * of 0, 50, or 100 for each dimension.
 *
 * @param params - The user's thesis matrix and selected candidate theses
 * @param log - Logger instance
 * @param chunkSize - Number of candidate theses per batch (default: 3)
 * @returns Raw LLM classification results (llmResults)
 */
export async function analyzeOriginalityRisk(
  params: AnalyzeOriginalityRiskParams,
  log: Logger,
  chunkSize = 3,
): Promise<{ llmResults: LLMScoredItem[] }> {
  log.file("analysis.ts");
  const startTime = performance.now();
  log.groupStart("originality_risk_analyze");

  try {
    const sortedTheses = [...params.selectedTheses].sort((a, b) => a.id - b.id);

    const chunks: TezaraThesisDetails[][] = [];
    for (let i = 0; i < sortedTheses.length; i += chunkSize) {
      chunks.push(sortedTheses.slice(i, i + chunkSize));
    }

    const userThesis = {
      mainActors: params.mainActors,
      researchFocus: params.researchFocus,
      context: params.context,
      theoreticalFramework: params.theoreticalFramework,
      methodology: params.methodology,
      mainClaim: params.mainClaim,
    };

    log.info("originality_classification_start", {
      service: "originality",
      data: { summary: `(${sortedTheses.length} theses)` },
    });

    const limiter = createConcurrencyLimiter(8);
    const chunkPromises = chunks.map((group) =>
      limiter.exec(async () => {
        const batchInput = group.map((t) => ({
          id: String(t.id),
          title: t.title,
          abstract: t.abstract,
        }));

        const result = await generateStructuredContent<LLMScoredItem[]>(
          GEMINI_MODEL,
          buildAnalysisSystemInstruction(),
          buildAnalysisPrompt(userThesis, batchInput),
          geminiBatchResponseSchema,
          log,
          {
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
            temperature: GEMINI_TEMPERATURE,
            seed: GEMINI_SEED,
            zodSchema: llmBatchResponseZodSchema,
            thesisMatrix: params,
            payloadStage: "originality_classification",
            quiet: true,
          },
        );

        const items = result || [];
        const returnedIds = new Set(items.map((it) => String(it.tez_id)));

        for (const thesis of group) {
          if (!returnedIds.has(String(thesis.id))) {
            log.error("originality_missing_thesis_id_corruption", {
              service: "originality",
              data: {
                thesisId: thesis.id,
                chunkIds: group.map((t) => t.id),
              },
            });
            throw new Error(
              "Classification payload corruption: The model omitted requested thesis IDs from the structured response.",
            );
          }
        }

        return items;
      }),
    );

    const nested = await Promise.all(chunkPromises);

    log.info("originality_classification_success", {
      service: "originality",
      durationMs: performance.now() - startTime,
    });

    const llmResults = nested
      .flat()
      .sort((a, b) => Number(a.tez_id) - Number(b.tez_id));

    log.preview(
      "LLM Classification Results",
      llmResults.map((o) => ({
        tez_id: o.tez_id,
        researchFocus: o.researchFocus,
        mainActors: o.mainActors,
        scopeContext: o.scopeContext,
        temporalLabel: o.temporalLabel,
        theoreticalFramework: o.theoreticalFramework,
        methodology: o.methodology,
        mainClaim: o.mainClaim,
      })),
    );

    const durationMs = performance.now() - startTime;
    log.groupEnd("originality_risk_analyze", durationMs);

    return { llmResults };
  } catch (err) {
    const durationMs = performance.now() - startTime;
    log.error("originality_risk_analyze_failed", {
      service: "originality",
      error: err,
      durationMs,
      data: { context: params.researchFocus },
    });
    log.groupEnd("originality_risk_analyze", durationMs);
    throw err;
  }
}
