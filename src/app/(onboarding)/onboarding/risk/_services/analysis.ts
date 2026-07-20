import { generateStructuredContent } from "@/lib/services/gemini";
import { GEMINI_MODEL, GEMINI_TEMPERATURE, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import { z } from "zod";
import type { Logger } from "@/lib/logger";
import type { TezaraThesisDetails } from "@/lib/types";
import {
  PARAM_DEFINITIONS,
  buildIsolatedSystemInstruction,
  buildIsolatedPrompt,
} from "@/lib/prompts/originality-analysis";
import type { ParamDefinition } from "@/lib/prompts/originality-analysis";

// ============================================================================
// LLM Output Types
// ============================================================================

export interface LLMScoredItem {
  tez_id: string;
  researchCore: 0 | 50 | 100;
  actor: 0 | 50 | 100;
  spatialContext: 0 | 50 | 100;
  temporalLabel: "OVERLAP" | "PAST" | "FUTURE" | "UNKNOWN";
  theoreticalFramework: 0 | 50 | 100;
  methodology: 0 | 50 | 100;
  mainClaim: 0 | 50 | 100;
}

const llmScoredItemZodSchema = z.object({
  tez_id: z.string(),
  researchCore: z.union([z.literal(0), z.literal(50), z.literal(100)]),
  actor: z.union([z.literal(0), z.literal(50), z.literal(100)]),
  spatialContext: z.union([z.literal(0), z.literal(50), z.literal(100)]),
  temporalLabel: z.enum(["OVERLAP", "PAST", "FUTURE", "UNKNOWN"]),
  theoreticalFramework: z.union([z.literal(0), z.literal(50), z.literal(100)]),
  methodology: z.union([z.literal(0), z.literal(50), z.literal(100)]),
  mainClaim: z.union([z.literal(0), z.literal(50), z.literal(100)]),
});

export const llmBatchResponseZodSchema = z.array(llmScoredItemZodSchema);

// ============================================================================
// Zod schema builder for per-parameter responses
// ============================================================================

function buildParamZodSchema(
  param: ParamDefinition,
): z.ZodType<{ tez_id: number; score: string | number }[]> {
  if (param.isStringEnum) {
    return z.array(
      z.object({
        tez_id: z.number(),
        score: z.enum(["OVERLAP", "PAST", "FUTURE", "UNKNOWN"]),
      }),
    ) as unknown as z.ZodType<{ tez_id: number; score: string | number }[]>;
  }
  return z.array(
    z.object({
      tez_id: z.number(),
      score: z.union([z.literal(0), z.literal(50), z.literal(100)]),
    }),
  ) as unknown as z.ZodType<{ tez_id: number; score: string | number }[]>;
}

// ============================================================================
// Analysis Orchestration
// ============================================================================

export type AnalyzeOriginalityRiskParams = {
  researchCore: string;
  targetActors: string;
  spatialContext: string;
  temporalContext: string;
  theoreticalFramework: string;
  methodology: string;
  mainClaim: string;
  selectedTheses: TezaraThesisDetails[];
};

/**
 * Compares selected candidate theses against the user's thesis matrix
 * using 7 parallel isolated Gemini calls — one per parameter (RF, MA, SC,
 * TF, ME, MC, Temporal). Each call scores ALL theses on a single parameter,
 * eliminating cross-contamination between dimensions.
 *
 * @param params - The user's thesis matrix and selected candidate theses
 * @param log - Logger instance
 * @returns Raw LLM classification results (llmResults)
 */
export async function analyzeOriginalityRisk(
  params: AnalyzeOriginalityRiskParams,
  log: Logger,
): Promise<{ llmResults: LLMScoredItem[] }> {
  log.file("analysis.ts");
  const startTime = performance.now();
  log.groupStart("originality_risk_analyze");

  try {
    const sortedTheses = [...params.selectedTheses].sort((a, b) => a.id - b.id);

    const userThesis = {
      researchCore: params.researchCore,
      targetActors: params.targetActors,
      spatialContext: params.spatialContext,
      temporalContext: params.temporalContext,
      theoreticalFramework: params.theoreticalFramework,
      methodology: params.methodology,
      mainClaim: params.mainClaim,
    };

    const thesesForPrompt = sortedTheses.map((t) => ({
      id: t.id,
      title: t.title,
      abstract: t.abstract,
    }));

    const systemInstruction = buildIsolatedSystemInstruction();

    log.info("originality_classification_start", {
      service: "originality",
      data: {
        summary: `(${sortedTheses.length} theses × ${PARAM_DEFINITIONS.length} isolated params)`,
      },
    });

    const limiter = createConcurrencyLimiter(8);
    const paramPromises = PARAM_DEFINITIONS.map((param) =>
      limiter.exec(
        async (): Promise<{
          paramKey: string;
          results: { tez_id: number; score: number | string }[];
        }> => {
          // Pass only the single matrix field relevant to this parameter.
          // All other matrix fields are intentionally withheld to prevent
          // cross-dimensional contamination in the LLM's reasoning.
          const prompt = buildIsolatedPrompt(
            userThesis[param.matrixField],
            thesesForPrompt,
            param,
          );

          const result = await generateStructuredContent<
            { tez_id: number; score: number | string }[]
          >(GEMINI_MODEL, systemInstruction, prompt, param.jsonSchema, log, {
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            temperature: GEMINI_TEMPERATURE,
            seed: GEMINI_SEED,
            zodSchema: buildParamZodSchema(param),
            thesisMatrix: params,
            payloadStage: `originality_classification_${param.key}`,
            quiet: true,
          });

          // Validate all thesis IDs are present
          const returnedIds = new Set(result.map((r) => r.tez_id));
          for (const thesis of sortedTheses) {
            if (!returnedIds.has(thesis.id)) {
              log.error("originality_missing_thesis_id_corruption", {
                service: "originality",
                data: {
                  paramKey: param.key,
                  thesisId: thesis.id,
                },
              });
              throw new Error(
                `Classification payload corruption for param "${param.key}": Model omitted thesis ID ${thesis.id} from the structured response.`,
              );
            }
          }

          return { paramKey: param.key, results: result };
        },
      ),
    );

    const paramResults = await Promise.all(paramPromises);

    log.info("originality_classification_success", {
      service: "originality",
      durationMs: performance.now() - startTime,
    });

    // Merge 7 param results into LLMScoredItem[]
    const thesisMap = new Map<number, Record<string, number | string>>();
    for (const { paramKey, results } of paramResults) {
      for (const item of results) {
        if (!thesisMap.has(item.tez_id)) {
          thesisMap.set(item.tez_id, {});
        }
        thesisMap.get(item.tez_id)![paramKey] = item.score;
      }
    }

    const llmResults: LLMScoredItem[] = sortedTheses
      .map((thesis) => {
        const scores = thesisMap.get(thesis.id);
        if (!scores) return null;

        return {
          tez_id: String(thesis.id),
          researchCore: (scores.RC ?? 0) as 0 | 50 | 100,
          actor: (scores.Actor ?? 0) as 0 | 50 | 100,
          spatialContext: (scores.SC ?? 0) as 0 | 50 | 100,
          temporalLabel: (scores.Temporal ?? "UNKNOWN") as
            "OVERLAP" | "PAST" | "FUTURE" | "UNKNOWN",
          theoreticalFramework: (scores.TF ?? 0) as 0 | 50 | 100,
          methodology: (scores.ME ?? 0) as 0 | 50 | 100,
          mainClaim: (scores.MC ?? 0) as 0 | 50 | 100,
        };
      })
      .filter((r): r is LLMScoredItem => r !== null);

    log.preview(
      "LLM Classification Results",
      llmResults.map((o) => ({
        tez_id: o.tez_id,
        researchCore: o.researchCore,
        actor: o.actor,
        spatialContext: o.spatialContext,
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
      data: { context: params.researchCore },
    });
    log.groupEnd("originality_risk_analyze", durationMs);
    throw err;
  }
}
