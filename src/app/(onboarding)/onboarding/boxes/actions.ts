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
} from "@/lib/prompts/box-generation/box-structure-prompt";
import {
  buildSemanticQuerySystemInstruction,
  buildSemanticQueryUserPrompt,
} from "@/lib/prompts/box-generation/semantic-query-prompt";
import {
  boxStructureSchema,
  boxStructureJsonSchema,
  bulkSemanticQuerySchema,
  bulkSemanticQueryJsonSchema,
  type RawBoxStructureResponse,
  type BulkSemanticQueryResponse,
} from "./_services/schemas";
import { type OnboardingActionResult, type GeminiThesisBox } from "@/lib/types";
import { mapToProductionShape } from "../_lib/box-mapper";
import { fetchThesisMatrix } from "../_services/fetch-actions";

const confirmBoxesSchema = z.array(
  z.object({
    title: z.string().min(1),
    boxType: z.enum([
      "SUBJECT_PROBLEM",
      "THEORETICAL_FRAMEWORK",
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
 * Phase 1: Generates the 4-quadrant Turkish box structure ONLY.
 * No semanticQuery generation — that happens in a separate Phase 2 call.
 *
 * @returns Raw box structure (without semanticQuery fields), or error.
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
 * Phase 2: Generates natural English semanticQuery for each sub-box
 * in a single bulk Gemini call. Requires Phase 1 to have completed.
 *
 * @param structure - Raw box structure from Phase 1
 * @returns Bulk of semantic queries mapped by sub-box title
 */
export async function generateSemanticQueriesAction(
  structure: RawBoxStructureResponse,
): Promise<
  | { success: true; queries: Map<string, string> }
  | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    log.info("semantic_query_generation_start", {
      service: "boxes",
      filePath: "src/app/(onboarding)/onboarding/boxes/actions.ts",
    });

    // Collect all sub-boxes with their context (skip PRIMARY_MATERIAL)
    const subBoxEntries: { title: string; boxType: string; description: string }[] = [];
    for (const key of ["subjectProblem", "theoreticalFramework", "methodology"] as const) {
      const quadrant = structure[key];
      for (const sb of quadrant.subBoxes) {
        subBoxEntries.push({
          title: sb.title,
          boxType: key === "subjectProblem"
            ? "SUBJECT_PROBLEM"
            : key === "theoreticalFramework"
              ? "THEORETICAL_FRAMEWORK"
              : "METHODOLOGY",
          description: sb.description ?? "",
        });
      }
    }

    if (subBoxEntries.length === 0) {
      return { success: true, queries: new Map() };
    }

    const prompt = buildSemanticQueryUserPrompt(subBoxEntries);

    const result = await generateStructuredContent<BulkSemanticQueryResponse>(
      FLASH_LITE_31,
      buildSemanticQuerySystemInstruction(),
      prompt,
      bulkSemanticQueryJsonSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        zodSchema: bulkSemanticQuerySchema,
        seed: GEMINI_SEED,
        payloadStage: "semantic_query_generation",
        quiet: true,
      },
    );

    // Build map: title → semanticQuery
    const queries = new Map<string, string>();
    for (const entry of result.semanticQueries) {
      queries.set(entry.subBoxTitle, entry.semanticQuery);
    }

    log.info("semantic_query_generation_success", {
      service: "boxes",
      durationMs: Math.round(performance.now() - startTime),
      data: { queryCount: queries.size },
    });

    return { success: true, queries };
  } catch (err) {
    log.error("semantic_query_generation_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error: "Semantik arama sorguları oluşturulurken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Converts a RawBoxStructureResponse (4 quadrants + analysis) to the RawQuadrants
 * shape expected by mapToProductionShape. Sub-boxes carry empty semanticQuery
 * at this stage — they are filled in Phase 2.
 */
function structureToQuadrants(
  structure: RawBoxStructureResponse,
): import("../_lib/box-mapper").RawQuadrants {
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
        foundationalQueries: [],
      })),
    };
  };

  return {
    subjectProblem: mapQuadrant("subjectProblem"),
    theoreticalFramework: mapQuadrant("theoreticalFramework"),
    primaryMaterial: mapQuadrant("primaryMaterial"),
    methodology: mapQuadrant("methodology"),
  };
}

/**
 * Generates box structure (Phase 1) + semantic queries (Phase 2) in two
 * separate Gemini calls, then converts to GeminiThesisBox[] for persistence.
 *
 * @returns Production-shaped boxes array or error.
 */
export async function generateAndMapBoxesAction(): Promise<
  { success: true; boxes: GeminiThesisBox[] } | { error: string }
> {
  // Phase 1: Box structure
  const structRes = await runBoxStructureAction();
  if ("error" in structRes) return structRes;

  // Phase 2: Semantic queries
  const queryRes = await generateSemanticQueriesAction(structRes.structure);
  if ("error" in queryRes) return queryRes;

  // Merge
  const quadrants = structureToQuadrants(structRes.structure);
  const boxes = mapToProductionShape(quadrants);

  // Apply semantic queries to matching sub-boxes
  for (const box of boxes) {
    if (box.parentId !== null && queryRes.queries.has(box.title)) {
      box.semanticQuery = queryRes.queries.get(box.title) ?? "";
    }
  }

  return { success: true, boxes };
}

/**
 * Persists the generated (and user-edited) subject boxes to the thesis_boxes
 * table within a transaction and invalidates caches.
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
 * Full Server Pipeline Action: Generates boxes (Phase 1) + semantic queries
 * (Phase 2) in separate Gemini calls, then persists to the database.
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

    // Phase 1 + Phase 2
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
