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
  log.info("ai_request_start", {
    service: "gemini",
    step: "analyze_originality_risk",
    data: { thesisCount: params.validDetails.length },
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
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        temperature: 0.1,
      },
    );

    const overlapTable = result.overlapTable || [];

    log.info("ai_request_success", {
      service: "gemini",
      step: "analyze_originality_risk",
      data: { thesisCount: overlapTable.length },
    });

    return { overlapTable };
  } catch (err) {
    log.error("ai_request_failed", {
      service: "gemini",
      step: "analyze_originality_risk",
      error: err,
    });
    throw err;
  }
}
