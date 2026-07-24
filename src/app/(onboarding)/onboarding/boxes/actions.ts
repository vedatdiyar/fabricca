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
  buildSemanticQueriesSystemInstruction,
  buildSemanticQueriesUserPrompt,
  semanticQueriesSchema,
  semanticQueriesJsonSchema,
  combineStructureAndQueries,
  type RawBoxStructureResponse,
  type RawSemanticQueriesResponse,
} from "@/lib/prompts/box-generation";
import { type OnboardingActionResult, type GeminiThesisBox } from "@/lib/types";
import { mapToProductionShape } from "../_lib/box-mapper";
import { fetchThesisMatrix } from "../_services/fetch-actions";

const confirmBoxesSchema = z.array(
  z.object({
    title: z.string().min(1),
    boxType: z.enum([
      "CONCEPTUAL",
      "PROBLEMATIZATION",
      "PRIMARY_MATERIAL",
      "CONTEXT",
      "DATA_PROTOCOL",
      "RELATED_THESES",
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
 * Phase 1 Server Action: Generates the 5-quadrant Turkish academic box structure
 * (titles, descriptions, concepts, and sub-boxes) based on the user's thesis matrix.
 *
 * @returns Phase 1 box structure or error string
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
      researchCore: matrix.researchCore,
      targetActors: matrix.targetActors,
      context: matrix.context,
      framework: matrix.framework,
      mainClaim: matrix.mainClaim,
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
 * Phase 2 Server Action: Takes Phase 1 box structure and generates high-precision,
 * quadrant-isolated OpenAlex GTE Large EN vector search paragraphs (semanticQuery).
 * Combines structure and queries, then returns flattened GeminiThesisBox[].
 *
 * @param structure - Phase 1 generated box structure response.
 * @returns Array of production-shaped GeminiThesisBox items or error string.
 */
export async function runSemanticQueriesAction(
  structure: RawBoxStructureResponse,
): Promise<{ success: true; boxes: GeminiThesisBox[] } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const matrix = await fetchThesisMatrix();
    if (!matrix) return { error: "Thesis matrix not found." };

    log.info("box_semantic_queries_start", {
      service: "boxes",
      filePath: "src/app/(onboarding)/onboarding/boxes/actions.ts",
    });

    const prompt = buildSemanticQueriesUserPrompt(structure, {
      researchCore: matrix.researchCore,
      targetActors: matrix.targetActors,
      context: matrix.context,
      framework: matrix.framework,
      mainClaim: matrix.mainClaim,
    });

    const queries = await generateStructuredContent<RawSemanticQueriesResponse>(
      FLASH_LITE_31,
      buildSemanticQueriesSystemInstruction(),
      prompt,
      semanticQueriesJsonSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        zodSchema: semanticQueriesSchema,
        seed: GEMINI_SEED,
        thesisMatrix: matrix,
        payloadStage: "box_semantic_queries_generation",
        quiet: true,
      },
    );

    const combined = combineStructureAndQueries(structure, queries);
    const normalizedBoxes = mapToProductionShape(combined);

    log.info("box_semantic_queries_success", {
      service: "boxes",
      durationMs: Math.round(performance.now() - startTime),
    });

    return { success: true, boxes: normalizedBoxes };
  } catch (err) {
    log.error("box_semantic_queries_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error: "Vektör arama sorguları üretilirken beklenmeyen bir hata oluştu.",
    };
  }
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
 * Full Server Pipeline Action: Runs Phase 1 (Structure) -> Phase 2 (Semantic Queries) -> Phase 3 (DB Persistence)
 * in sequence when called from server context.
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

    // Step 1: Generate Turkish box structure
    const structRes = await runBoxStructureAction();
    if ("error" in structRes) return structRes;

    // Step 2: Generate English OpenAlex semanticQueries
    const queryRes = await runSemanticQueriesAction(structRes.structure);
    if ("error" in queryRes) return queryRes;

    // Step 3: Persist to database
    const persistRes = await persistBoxesAction(queryRes.boxes);
    if ("error" in persistRes && persistRes.error) {
      return { error: persistRes.error };
    }

    log.info("boxes_full_pipeline_success", {
      service: "boxes",
      durationMs: Math.round(performance.now() - pipelineStart),
    });

    return { success: true, boxes: queryRes.boxes };
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
