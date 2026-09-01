import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { generateGeminiStructuredContent } from "@/core/services/ai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { buildSemanticQueryPromptPayload } from "../_prompts/semantic-query.prompt";
import {
  bulkSemanticQuerySchema,
  bulkSemanticQueryJsonSchema,
  type BulkSemanticQueryResponse,
  type RawBoxStructureResponse,
} from "./schemas";
import type { RawQuadrants } from "./box-mapper";

import { fetchThesisMatrix } from "@/app/(onboarding)/onboarding/_services/fetch-actions";

import type { PipelineRun } from "@/lib/pipeline-logger";

/**
 * Phase 2: generates English semantic queries for every sub-box in a single Gemini call.
 *
 * @param structure - The raw box structure generated in phase 1.
 * @param flowId - Optional shared flow identifier of the parent pipeline run.
 * @param pipelineRun - Optional parent PipelineRun instance for step emission.
 * @returns The semantic queries keyed by sub-box title, or an error message.
 */
export async function generateSemanticQueriesAction(
  structure: RawBoxStructureResponse,
  flowId?: string,
  pipelineRun?: PipelineRun,
): Promise<
  { success: true; queries: Map<string, string> } | { error: string }
> {
  const log = new Logger(flowId ?? createFlowId());
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    log.info("semantic_query_generation_start", {
      service: "boxes",
      filePath: "src/features/boxes/semantic-queries.ts",
      hidden: true,
    });

    const dbMatrix = await fetchThesisMatrix();

    const subBoxEntries: {
      title: string;
      boxType: string;
      description: string;
      concepts?: string[];
    }[] = [];
    for (const key of [
      "subjectProblem",
      "theoreticalFramework",
      "methodology",
    ] as const) {
      const quadrant = structure[key];
      for (const sb of quadrant.subBoxes) {
        subBoxEntries.push({
          title: sb.title,
          boxType:
            key === "subjectProblem"
              ? "SUBJECT_PROBLEM"
              : key === "theoreticalFramework"
                ? "THEORETICAL_FRAMEWORK"
                : "METHODOLOGY",
          description: sb.description ?? "",
          concepts: sb.concepts ?? [],
        });
      }
    }

    if (subBoxEntries.length === 0) {
      return { success: true, queries: new Map() };
    }

    const matrixContext = {
      subjectProblem:
        dbMatrix?.subjectProblem ?? structure.subjectProblem?.description,
      theoreticalFramework:
        dbMatrix?.theoreticalFramework ??
        structure.theoreticalFramework?.description,
      methodology: dbMatrix?.methodology ?? structure.methodology?.description,
    };

    const payload = buildSemanticQueryPromptPayload({
      matrix: matrixContext,
      subBoxes: subBoxEntries,
    });

    const result =
      await generateGeminiStructuredContent<BulkSemanticQueryResponse>(
        FLASH_LITE_35,
        payload.systemInstruction,
        payload.userPrompt,
        bulkSemanticQueryJsonSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          zodSchema: bulkSemanticQuerySchema,
          seed: GEMINI_SEED,
          payloadStage: "semantic_query_generation",
          quiet: true,
        },
      );

    const queries = new Map<string, string>();
    for (const entry of result.semanticQueries) {
      queries.set(entry.subBoxTitle, entry.semanticQuery);
    }

    const durationMs = performance.now() - startTime;
    pipelineRun?.subStep("Semantic Query Synthesis (Gemini Flash)", durationMs);

    log.info("semantic_query_generation_success", {
      service: "boxes",
      durationMs: Math.round(durationMs),
      data: { queryCount: queries.size },
      hidden: true,
    });

    return { success: true, queries };
  } catch (err) {
    log.error("semantic_query_generation_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error:
        "Semantik arama sorguları oluşturulurken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Converts the raw box structure to the RawQuadrants shape expected by mapToProductionShape.
 *
 * @param structure - The raw box structure to convert.
 * @returns The quadrants shaped for production mapping.
 */
export function structureToQuadrants(
  structure: RawBoxStructureResponse,
): RawQuadrants {
  const mapQuadrant = (
    key:
      | "subjectProblem"
      | "theoreticalFramework"
      | "primaryMaterial"
      | "methodology",
  ) => {
    const q = structure[key];
    return {
      title: q.title,
      description: q.description,
      subBoxes: q.subBoxes.map((sb) => ({
        title: sb.title,
        description: sb.description,
        concepts: sb.concepts,
        semanticQuery: "",
      })),
    };
  };

  return {
    subjectProblem: mapQuadrant("subjectProblem"),
    theoreticalFramework: mapQuadrant("theoreticalFramework"),
    methodology: mapQuadrant("methodology"),
    primaryMaterial: mapQuadrant("primaryMaterial"),
  };
}
