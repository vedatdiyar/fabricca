import { ThinkingLevel } from "@google/genai";
import { generateStructuredContent } from "@/lib/gemini";
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
  theoreticalFramework: string;
  methodology: string;
  dataStrategy: string;
  historicalLimits: string;
  spatialLimits: string;
  analyticalFocus: string;
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
  log.info("originality_roadmap_synthesize_start", {
    service: "originality",
    data: {
      count: params.comparisonResults.length,
      context: params.studyTitle,
    },
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
    } catch {
      log.warn("originality_roadmap_thinking_fallback", {
        service: "originality",
        data: {
          reason: "HIGH thinking failed, falling back to MINIMAL",
          context: params.studyTitle,
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

    const durationMs = performance.now() - startTime;
    const tokens = log.lastTokens || { input: 0, output: 0 };

    log.preview(
      "Roadmap Result (first 300 chars)",
      roadmapResult.strategicRecommendations?.slice(0, 300),
    );

    log.info("originality_roadmap_synthesize_success", {
      service: "originality",
      durationMs,
      tokens: { input: tokens.input ?? 0, output: tokens.output ?? 0 },
      data: {
        count: 1,
        context: params.studyTitle,
      },
    });

    return roadmapResult.strategicRecommendations;
  } catch (err) {
    log.error("originality_roadmap_synthesize_failed", {
      service: "originality",
      error: err,
      data: { context: params.studyTitle },
    });
    throw err;
  }
}
