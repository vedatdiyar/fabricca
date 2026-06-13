import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import type { OverlapItem, TezaraThesisDetails, AxesOption } from "@/lib/types";
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
 * @returns Gemini response containing the evaluation overlap table.
 */
export async function analyze4Axes(
  params: Analyze4AxesParams,
  log: Logger,
): Promise<{ overlapTable: OverlapItem[] }> {
  log.info("ai_request_start", {
    service: "gemini",
    step: "analyze_4_axes",
    data: { thesisCount: params.validDetails.length },
  });

  try {
    const result = await generateStructuredContent<{
      overlapTable: {
        id: number;
        scores: {
          subjectScore: number;
          theoryScore: number;
          methodologyScore: number;
          contextScore: number;
        };
        axes: {
          subject: AxesOption;
          theory: AxesOption;
          methodology: AxesOption;
          context: AxesOption;
        };
        comparisonNote: string;
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

    const mergedOverlapTable = (result.overlapTable || []).map(
      ({ scores, ...clean }) => clean,
    );

    log.info("ai_request_success", {
      service: "gemini",
      step: "analyze_4_axes",
      data: { thesisCount: mergedOverlapTable.length },
    });

    return { overlapTable: mergedOverlapTable };
  } catch (err) {
    log.error("ai_request_failed", {
      service: "gemini",
      step: "analyze_4_axes",
      error: err,
    });
    throw err;
  }
}
