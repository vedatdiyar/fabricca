"use server";

import { type GeminiThesisBox } from "@/lib/types";
import { PipelineRun } from "@/lib/pipeline-logger";
import { BOX_GENERATION_PIPELINE } from "@/lib/pipeline-definitions";
import { mapToProductionShape } from "@/app/(onboarding)/onboarding/boxes/_services/box-mapper";
import { runBoxStructureAction } from "@/app/(onboarding)/onboarding/boxes/_services/structure-generation";
import {
  generateSemanticQueriesAction,
  structureToQuadrants,
} from "@/app/(onboarding)/onboarding/boxes/_services/semantic-queries";
import { persistBoxesAction as persistBoxesActionImpl } from "@/app/(onboarding)/onboarding/boxes/_services/persist-boxes";

export async function persistBoxesAction(
  boxes: GeminiThesisBox[],
  flowId?: string,
): Promise<Awaited<ReturnType<typeof persistBoxesActionImpl>>> {
  return persistBoxesActionImpl(boxes, flowId);
}

/**
 * Runs Phase 1 + Phase 2 and maps the result to production-shaped boxes.
 *
 * @param flowId - Optional shared flow identifier of the box generation pipeline run.
 * @returns The production-shaped boxes or an error message.
 */
export async function generateAndMapBoxesAction(
  flowId?: string,
): Promise<{ success: true; boxes: GeminiThesisBox[] } | { error: string }> {
  const run = flowId
    ? PipelineRun.resume(BOX_GENERATION_PIPELINE, flowId)
    : PipelineRun.create(BOX_GENERATION_PIPELINE);

  try {
    const boxes = await run.execute(
      "generate",
      async () => {
        const structRes = await runBoxStructureAction(
          flowId ?? run.flowId,
          run,
        );
        if ("error" in structRes) {
          throw new Error(structRes.technicalError ?? structRes.error);
        }

        const queryRes = await generateSemanticQueriesAction(
          structRes.structure,
          run.flowId,
          run,
        );
        if ("error" in queryRes) {
          throw new Error(queryRes.technicalError ?? queryRes.error);
        }

        const quadrants = structureToQuadrants(structRes.structure);
        const mapped = mapToProductionShape(quadrants);

        for (const box of mapped) {
          if (box.parentId !== null && queryRes.queries.has(box.title)) {
            box.semanticQuery = queryRes.queries.get(box.title) ?? "";
          }
        }

        return mapped;
      },
      { description: "Box Structure & Semantic Queries" },
    );

    return { success: true, boxes };
  } catch (err) {
    void err;
    return {
      error: "Konu kutuları oluşturulurken beklenmeyen bir hata oluştu.",
    };
  }
}
