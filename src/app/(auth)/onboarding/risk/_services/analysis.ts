import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import type { GeminiAnalysisResponse, TezaraThesisDetails } from "@/lib/types";
import {
  geminiAnalysisSchema,
  ANALYSIS_SYSTEM_INSTRUCTION,
  buildAnalysisPrompt,
} from "@/lib/prompts";

export interface Analyze4AxesParams {
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
 * across four analytical axes (Subject, Theory, Methodology, Context) using Gemini.
 *
 * @param params - Comparison target matrix and candidate details.
 * @param log - Logger instance.
 * @returns Gemini response containing the evaluation overlap table and recommendations.
 */
export async function analyze4Axes(
  params: Analyze4AxesParams,
  log: Logger,
): Promise<GeminiAnalysisResponse> {
  log.info("ai_request_start", {
    service: "gemini",
    step: "analyze_4_axes",
    data: { thesisCount: params.validDetails.length },
  });

  try {
    const geminiResult =
      await generateStructuredContent<GeminiAnalysisResponse>(
        "gemini-3.1-flash-lite",
        ANALYSIS_SYSTEM_INSTRUCTION,
        buildAnalysisPrompt(params),
        geminiAnalysisSchema,
        log,
      );

    log.info("ai_request_success", {
      service: "gemini",
      step: "analyze_4_axes",
      data: { thesisCount: geminiResult.overlapTable.length },
    });

    return geminiResult;
  } catch (err) {
    log.error("ai_request_failed", {
      service: "gemini",
      step: "analyze_4_axes",
      error: err,
    });
    throw err;
  }
}
