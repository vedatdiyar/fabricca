import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
import { extractMessage } from "@/lib/error-utils";
import type { Logger } from "@/lib/logger";
import {
  roadmapSchema,
  buildRoadmapSystemInstruction,
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
    originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
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
  log.file("roadmap.ts:42");
  const startTime = performance.now();
  log.info({
    step: "synthesize_roadmap",
    status: "START",
    comparisonCount: params.comparisonResults.length,
  });

  try {
    let roadmapResult;
    const roadmapPrompt = buildRoadmapPrompt(params);
    try {
      log.prompt("gemini-3.1-flash-lite (HIGH thinking)", roadmapPrompt);

      roadmapResult = await generateStructuredContent<{
        strategicRecommendations: string;
      }>(
        "gemini-3.1-flash-lite",
        buildRoadmapSystemInstruction(),
        roadmapPrompt,
        roadmapSchema,
        log,
        {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      );
    } catch (roadmapError) {
      log.warn({
        step: "roadmap_thinking_failed_fallback",
        status: "RETRYING",
        diagnostics: {
          errorCode: "ROADMAP_THINKING_ERROR",
          message: extractMessage(roadmapError),
          fallbackModel: "gemini-3.1-flash-lite-no-thinking",
        },
      });

      roadmapResult = await generateStructuredContent<{
        strategicRecommendations: string;
      }>(
        "gemini-3.1-flash-lite",
        buildRoadmapSystemInstruction(),
        roadmapPrompt,
        roadmapSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      );
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";
    const tokens = log.lastTokens || { input: 0, output: 0 };

    log.preview("Roadmap Result (first 300 chars)", roadmapResult.strategicRecommendations?.slice(0, 300));

    log.info({
      step: "synthesize_roadmap",
      status: "SUCCESS",
      metrics: {
        duration,
        tokens: {
          prompt: tokens.input ?? 0,
          completion: tokens.output ?? 0,
        },
        outputRows: 1,
      },
    });

    return roadmapResult.strategicRecommendations;
  } catch (err) {
    log.error({
      step: "synthesize_roadmap",
      status: "FAILED",
      diagnostics: {
        errorCode: "GEMINI_ROADMAP_ERROR",
        message: extractMessage(err),
        model: "gemini-3.1-flash-lite",
      },
    });
    throw err;
  }
}
