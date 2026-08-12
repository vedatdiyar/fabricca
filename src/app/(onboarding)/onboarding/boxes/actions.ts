"use server";

import { createFlowId, Logger } from "@/lib/logger";
import { type GeminiThesisBox } from "@/lib/types";
import { mapToProductionShape } from "@/features/boxes/box-mapper";
import { runBoxStructureAction as runBoxStructureActionImpl } from "@/features/boxes/structure-generation";
import {
  generateSemanticQueriesAction as generateSemanticQueriesActionImpl,
  structureToQuadrants,
} from "@/features/boxes/semantic-queries";
import {
  persistBoxesAction as persistBoxesActionImpl,
  confirmBoxesAction as confirmBoxesActionImpl,
} from "@/features/boxes/persist-boxes";

/**
 * Re-exported service actions preserved for backward compatibility.
 */
export async function runBoxStructureAction() {
  return runBoxStructureActionImpl();
}

export async function generateSemanticQueriesAction(
  structure: Parameters<typeof generateSemanticQueriesActionImpl>[0],
) {
  return generateSemanticQueriesActionImpl(structure);
}

export async function persistBoxesAction(boxes: GeminiThesisBox[]) {
  return persistBoxesActionImpl(boxes);
}

export async function confirmBoxesAction(boxes: GeminiThesisBox[]) {
  return confirmBoxesActionImpl(boxes);
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

/**
 * Runs the full legacy pipeline: generation (Phase 1 + 2) and persistence.
 *
 * @returns The generated boxes or an error message.
 */
export async function runBoxesPipelineAction(): Promise<
  { success: true; boxes: GeminiThesisBox[] } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const pipelineStart = performance.now();

  try {
    const genRes = await generateAndMapBoxesAction();
    if ("error" in genRes) return genRes;

    const persistRes = await persistBoxesAction(genRes.boxes);
    if ("error" in persistRes && persistRes.error) {
      return { error: persistRes.error };
    }

    log.info("boxes_full_pipeline_success", {
      service: "boxes",
      durationMs: Math.round(performance.now() - pipelineStart),
    });

    return { success: true, boxes: genRes.boxes };
  } catch (err) {
    log.error("boxes_full_pipeline_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error: "Konu kutuları oluşturulurken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Legacy alias for runBoxesPipelineAction.
 */
export async function generateBoxesStructureAction() {
  return runBoxesPipelineAction();
}
