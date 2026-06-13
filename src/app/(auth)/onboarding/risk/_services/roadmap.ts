import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import type { Logger } from "@/lib/logger";
import {
  roadmapSchema,
  ROADMAP_SYSTEM_INSTRUCTION,
  buildRoadmapPrompt,
} from "@/lib/prompts";

export interface SynthesizeRoadmapParams {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  methodology: string;
  theoreticalFramework: string;
  historicalSpatialLimits: string;
  comparisonResults: {
    title: string;
    author: string;
    year: number;
    axes: {
      subject: string;
      theory: string;
      methodology: string;
      context?: string;
    };
    originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
    comparisonNote: string;
  }[];
}

/**
 * Synthesizes a strategic roadmap to overcome academic overlap risks using Gemini.
 *
 * @param params - Target thesis parameters and the computed comparison results of candidate theses.
 * @param log - Logger instance.
 * @returns A string containing the strategic recommendations.
 */
export async function synthesizeRoadmap(
  params: SynthesizeRoadmapParams,
  log: Logger,
): Promise<string> {
  log.info("ai_request_start", {
    service: "gemini",
    step: "synthesize_roadmap",
    data: { comparisonCount: params.comparisonResults.length },
  });

  try {
    let roadmapResult;
    try {
      roadmapResult = await generateStructuredContent<{
        strategicRecommendations: string;
      }>(
        "gemini-3.1-flash-lite",
        ROADMAP_SYSTEM_INSTRUCTION,
        buildRoadmapPrompt(params),
        roadmapSchema,
        log,
        {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
          temperature: 0.1,
        },
      );
    } catch (roadmapError) {
      log.warn("ai_retry_attempt", {
        service: "gemini",
        step: "roadmap_thinking_failed_fallback",
        error:
          roadmapError instanceof Error
            ? roadmapError.message
            : String(roadmapError),
        data: { fallbackModel: "gemini-3.1-flash-lite-no-thinking" },
      });

      roadmapResult = await generateStructuredContent<{
        strategicRecommendations: string;
      }>(
        "gemini-3.1-flash-lite",
        ROADMAP_SYSTEM_INSTRUCTION,
        buildRoadmapPrompt(params),
        roadmapSchema,
        log,
        {
          thinkingConfig: null,
          temperature: 0.1,
        },
      );
    }

    log.info("ai_request_success", {
      service: "gemini",
      step: "synthesize_roadmap",
    });

    return roadmapResult.strategicRecommendations;
  } catch (err) {
    log.error("ai_request_failed", {
      service: "gemini",
      step: "synthesize_roadmap",
      error: err,
    });
    throw err;
  }
}
