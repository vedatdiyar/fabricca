import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import type { TezaraThesisDetails } from "@/lib/types";
import {
  geminiAnalysisSchema,
  ANALYSIS_SYSTEM_INSTRUCTION,
  buildAnalysisPrompt,
} from "@/lib/prompts";

export interface AnalyzeOriginalityRiskParams {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
  validDetails: TezaraThesisDetails[];
}

/**
 * Performs comparison between target thesis and a list of identified academic theses
 * using the Academic Jury Analysis model.
 *
 * @param params - Comparison target matrix and candidate details.
 * @param log - Logger instance.
 * @returns Gemini response containing the evaluation overlap table.
 */
export async function analyzeOriginalityRisk(
  params: AnalyzeOriginalityRiskParams,
  log: Logger,
): Promise<{
  overlapTable: {
    id: number;
    academic_reasoning: string;
    is_research_question_overlapping: boolean;
    is_methodology_overlapping: boolean;
    is_theory_overlapping: boolean;
    is_context_overlapping: boolean;
  }[];
}> {
  const startTime = performance.now();
  log.info({
    step: "analyze_originality_risk",
    status: "START",
    thesisCount: params.validDetails.length,
  });

  try {
    const result = await generateStructuredContent<{
      overlapTable: {
        id: number;
        academic_reasoning: string;
        is_research_question_overlapping: boolean;
        is_methodology_overlapping: boolean;
        is_theory_overlapping: boolean;
        is_context_overlapping: boolean;
      }[];
    }>(
      "gemini-3.1-flash-lite",
      ANALYSIS_SYSTEM_INSTRUCTION,
      buildAnalysisPrompt(params),
      geminiAnalysisSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    );

    const overlapTable = result.overlapTable || [];

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";
    const tokens = log.lastTokens || { input: 0, output: 0 };

    log.info({
      step: "analyze_originality_risk",
      status: "SUCCESS",
      metrics: {
        duration,
        tokens: {
          prompt: tokens.input ?? 0,
          completion: tokens.output ?? 0,
        },
        outputRows: overlapTable.length,
      },
    });

    return { overlapTable };
  } catch (err) {
    log.error({
      step: "analyze_originality_risk",
      status: "FAILED",
      diagnostics: {
        errorCode: "GEMINI_ANALYSIS_ERROR",
        message: err instanceof Error ? err.message : String(err),
        model: "gemini-3.1-flash-lite",
      },
    });
    throw err;
  }
}
