"use server";

import { createFlowId, Logger } from "@/lib/logger";
import { type GeminiThesisBox } from "@/lib/types";
import { mapToProductionShape } from "@/app/(onboarding)/onboarding/boxes/_services/box-mapper";
import { runBoxStructureAction } from "@/app/(onboarding)/onboarding/boxes/_services/structure-generation";
import {
  generateSemanticQueriesAction,
  structureToQuadrants,
} from "@/app/(onboarding)/onboarding/boxes/_services/semantic-queries";
import { persistBoxesAction as persistBoxesActionImpl } from "@/app/(onboarding)/onboarding/boxes/_services/persist-boxes";

export async function persistBoxesAction(
  boxes: GeminiThesisBox[],
): Promise<Awaited<ReturnType<typeof persistBoxesActionImpl>>> {
  return persistBoxesActionImpl(boxes);
}

/**
 * Runs Phase 1 + Phase 2 and maps the result to production-shaped boxes.
 *
 * @returns The production-shaped boxes or an error message.
 */
export async function generateAndMapBoxesAction(): Promise<
  { success: true; boxes: GeminiThesisBox[] } | { error: string }
> {
  const structRes = await runBoxStructureAction();
  if ("error" in structRes) return structRes;

  const queryRes = await generateSemanticQueriesAction(structRes.structure);
  if ("error" in queryRes) return queryRes;

  const quadrants = structureToQuadrants(structRes.structure);
  const boxes = mapToProductionShape(quadrants);

  for (const box of boxes) {
    if (box.parentId !== null && queryRes.queries.has(box.title)) {
      box.semanticQuery = queryRes.queries.get(box.title) ?? "";
    }
  }

  return { success: true, boxes };
}

/**
 * Emits the final pipeline total-duration SUCCESS log line.
 *
 * @param durationMs - Total pipeline duration in milliseconds.
 */
export async function logBoxesPipelineSuccessAction(
  durationMs: number,
): Promise<void> {
  const log = new Logger(createFlowId());
  log.info("boxes_full_pipeline_success", {
    service: "boxes",
    data: { durationMs: Math.round(durationMs) },
  });
}
