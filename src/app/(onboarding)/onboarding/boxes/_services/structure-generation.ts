"use server";

import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { generateGeminiStructuredContent } from "@/core/services/ai";
import { FLASH_LITE_35, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { buildBoxStructurePromptPayload } from "../_prompts/box-structure.prompt";
import {
  boxStructureSchema,
  boxStructureJsonSchema,
  type RawBoxStructureResponse,
} from "./schemas";
import { fetchThesisMatrix } from "@/app/(onboarding)/onboarding/_services/fetch-actions";

/**
 * Phase 1: generates the 4-quadrant Turkish box structure only (no semantic queries).
 *
 * @param flowId - Optional shared flow identifier of the parent pipeline run.
 * @returns The generated box structure or an error message.
 */
export async function runBoxStructureAction(
  flowId?: string,
): Promise<
  { success: true; structure: RawBoxStructureResponse } | { error: string }
> {
  const log = new Logger(flowId ?? createFlowId());
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const matrix = await fetchThesisMatrix();
    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    log.info("box_structure_generation_start", {
      service: "boxes",
    });

    const payload = buildBoxStructurePromptPayload({
      subjectProblem: matrix.subjectProblem,
      theoreticalFramework: matrix.theoreticalFramework,
      primaryMaterial: matrix.primaryMaterial ?? "",
      methodology: matrix.methodology,
    });

    const structure =
      await generateGeminiStructuredContent<RawBoxStructureResponse>(
        FLASH_LITE_35,
        payload.systemInstruction,
        payload.userPrompt,
        boxStructureJsonSchema,
        log,
        {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          zodSchema: boxStructureSchema,
          seed: GEMINI_SEED,
          thesisMatrix: matrix,
          payloadStage: "box_structure_generation",
          quiet: true,
        },
      );

    log.info("box_structure_generation_success", {
      service: "boxes",
      durationMs: Math.round(performance.now() - startTime),
    });

    return { success: true, structure };
  } catch (err) {
    log.error("box_structure_generation_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error: "Konu kutusu yapısı oluşturulurken beklenmeyen bir hata oluştu.",
    };
  }
}
