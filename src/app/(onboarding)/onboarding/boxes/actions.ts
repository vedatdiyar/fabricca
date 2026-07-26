"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { thesisBoxes } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { generateStructuredContent } from "@/lib/services/gemini";
import { FLASH_LITE_31, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { updateTag } from "next/cache";
import { CACHE_TAGS, revalidateOnboardingPaths } from "@/lib/cache-tags";
import {
  buildBoxStructureSystemInstruction,
  buildBoxStructureUserPrompt,
  boxStructureSchema,
  boxStructureJsonSchema,
  type RawBoxStructureResponse,
} from "@/lib/prompts/box-generation";
import { type OnboardingActionResult, type GeminiThesisBox } from "@/lib/types";
import { mapToProductionShape } from "../_lib/box-mapper";
import { fetchThesisMatrix } from "../_services/fetch-actions";

const confirmBoxesSchema = z.array(
  z.object({
    title: z.string().min(1),
    boxType: z.enum([
      "SUBJECT_PROBLEM",
      "THEORETICAL_FRAMEWORK",
      "ANALYSIS_ACTORS",
      "PRIMARY_MATERIAL",
      "METHODOLOGY",
    ]),
    description: z.string().optional().default(""),
    parentId: z.number().nullable(),
    semanticQuery: z.string().nullable(),
    subBoxes: z.any().optional(),
    concepts: z.array(z.string()).optional().default([]),
    foundationalQueries: z
      .array(
        z.object({
          title: z.string(),
          author: z.string(),
          publicationYear: z.number(),
        }),
      )
      .optional()
      .default([]),
  }),
);

/**
 * Single-phase server action: generates the 5-quadrant Turkish box structure
 * AND quadrant-isolated English OpenAlex semanticQuery paragraphs in one call.
 * Each quadrant sees only its own relevant matrix field(s) — no cross-quadrant
 * context leaks into the query generation.
 *
 * @returns Raw box structure with inline semanticQuery fields, or error.
 */
export async function runBoxStructureAction(): Promise<
  { success: true; structure: RawBoxStructureResponse } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const matrix = await fetchThesisMatrix();
    if (!matrix) return { error: "Thesis matrix not found." };

    log.info("box_structure_generation_start", {
      service: "boxes",
      filePath: "src/app/(onboarding)/onboarding/boxes/actions.ts",
    });

    const prompt = buildBoxStructureUserPrompt({
      subjectProblem: matrix.subjectProblem,
      theoreticalFramework: matrix.theoreticalFramework,
      analysisActors: matrix.analysisActors ?? "",
      primaryMaterial: matrix.primaryMaterial ?? "",
      methodology: matrix.methodology,
    });

    const structure = await generateStructuredContent<RawBoxStructureResponse>(
      FLASH_LITE_31,
      buildBoxStructureSystemInstruction(),
      prompt,
      boxStructureJsonSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
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

/**
 * Converts a RawBoxStructureResponse (5 quadrants + analysis) to the RawQuadrants
 * shape expected by mapToProductionShape. Each sub-box carries its own semanticQuery
 * inline (generated in the single-phase call).
 */
function structureToQuadrants(
  structure: RawBoxStructureResponse,
): import("../_lib/box-mapper").RawQuadrants {
  const mapQuadrant = (
    key:
      | "subjectProblem"
      | "theoreticalFramework"
      | "analysisActors"
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
        semanticQuery: sb.semanticQuery ?? "",
        foundationalQueries: [],
      })),
    };
  };

  return {
    subjectProblem: mapQuadrant("subjectProblem"),
    theoreticalFramework: mapQuadrant("theoreticalFramework"),
    analysisActors: mapQuadrant("analysisActors"),
    primaryMaterial: mapQuadrant("primaryMaterial"),
    methodology: mapQuadrant("methodology"),
  };
}

/**
 * Generates box structure (with inline semantic queries) and converts to
 * GeminiThesisBox[] for persistence. Used by the pipeline action.
 *
 * @returns Production-shaped boxes array or error.
 */
export async function generateAndMapBoxesAction(): Promise<
  { success: true; boxes: GeminiThesisBox[] } | { error: string }
> {
  const structRes = await runBoxStructureAction();
  if ("error" in structRes) return structRes;

  const quadrants = structureToQuadrants(structRes.structure);
  const boxes = mapToProductionShape(quadrants);

  return { success: true, boxes };
}

/**
 * Phase 3 Server Action: Persists the generated (and user-edited) subject boxes
 * to the thesis_boxes table within a transaction and invalidates caches.
 *
 * @param boxes - The GeminiThesisBox array to persist.
 * @returns Success or error response.
 */
export async function persistBoxesAction(
  boxes: unknown,
): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const matrix = await fetchThesisMatrix();
    if (!matrix) return { error: "Thesis matrix not found." };

    log.info("boxes_persist_start", {
      service: "boxes",
      filePath: "src/app/(onboarding)/onboarding/boxes/actions.ts",
    });

    const parsed = confirmBoxesSchema.safeParse(boxes);
    if (!parsed.success) {
      log.error("boxes_persist_validation_failed", {
        service: "boxes",
        error: parsed.error,
      });
      return { error: "Geçersiz konu kutusu verisi alındı." };
    }

    const validBoxes = parsed.data;
    const thesisMatrixId = matrix.id;

    await db.transaction(async (tx) => {
      await tx
        .delete(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

      const parentFlatIndices: number[] = [];
      for (let i = 0; i < validBoxes.length; i++) {
        if (validBoxes[i].parentId === null) {
          parentFlatIndices.push(i);
        }
      }

      const parentValues = parentFlatIndices.map((i) => ({
        thesisMatrixId,
        title: validBoxes[i].title,
        boxType: validBoxes[i].boxType,
        description: validBoxes[i].description || "",
        parentId: null,
        semanticQuery: null,
        foundationalQueries: validBoxes[i].foundationalQueries || [],
        concepts: validBoxes[i].concepts || [],
      }));

      let insertedParents: { id: number }[] = [];
      if (parentValues.length > 0) {
        insertedParents = await tx
          .insert(thesisBoxes)
          .values(parentValues)
          .returning({ id: thesisBoxes.id });
      }

      const dbParentIdMap = new Map<number, number>();
      for (let j = 0; j < parentFlatIndices.length; j++) {
        const dbId = insertedParents[j]?.id;
        if (dbId !== undefined) {
          dbParentIdMap.set(parentFlatIndices[j], dbId);
        }
      }

      const childValues: (typeof thesisBoxes.$inferInsert)[] = [];
      for (let i = 0; i < validBoxes.length; i++) {
        const box = validBoxes[i];
        if (box.parentId === null) continue;
        const mappedParentId = dbParentIdMap.get(box.parentId) ?? null;
        childValues.push({
          thesisMatrixId,
          title: box.title,
          boxType: box.boxType,
          description: box.description || "",
          parentId: mappedParentId,
          semanticQuery: box.semanticQuery || "",
          foundationalQueries: box.foundationalQueries ?? [],
          concepts: box.concepts ?? [],
        });
      }

      if (childValues.length > 0) {
        await tx.insert(thesisBoxes).values(childValues);
      }
    });

    try {
      revalidateOnboardingPaths();
      updateTag(CACHE_TAGS.thesisBoxes);
    } catch {
      // Fallback when executed outside Next.js request context (e.g., CLI / tests)
    }

    log.info("boxes_persist_success", {
      service: "boxes",
      durationMs: Math.round(performance.now() - startTime),
    });

    return { success: true };
  } catch (err) {
    log.error("boxes_persist_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return { error: "Konu kutuları veritabanına kaydedilemedi." };
  }
}

/**
 * Legacy alias for persistBoxesAction to ensure full backward compatibility.
 */
export const confirmBoxesAction = persistBoxesAction;

/**
 * Full Server Pipeline Action: Generates boxes (with inline semanticQuery)
 * in a single phase, then persists to the database.
 *
 * @returns Generated boxes array or error response.
 */
export async function runBoxesPipelineAction(): Promise<
  { success: true; boxes: GeminiThesisBox[] } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const pipelineStart = performance.now();

  try {
    log.info("boxes_full_pipeline_start", {
      service: "boxes",
      filePath: "src/app/(onboarding)/onboarding/boxes/actions.ts",
    });

    // Single phase: generate structure + semanticQuery in one call
    const genRes = await generateAndMapBoxesAction();
    if ("error" in genRes) return genRes;

    // Persist to database
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
export const generateBoxesStructureAction = runBoxesPipelineAction;
