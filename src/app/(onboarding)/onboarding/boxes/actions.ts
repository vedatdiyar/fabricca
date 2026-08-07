"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { boxes as boxRows } from "@/db/schema";
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
      "METHODOLOGY",
      "PRIMARY_MATERIAL",
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
 * Phase 1: generates the 4-quadrant Turkish box structure only (no semantic queries).
 *
 * @returns The generated box structure or an error message.
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
 * Phase 2: generates English semantic queries for every sub-box in a single Gemini call.
 *
 * @param structure - The raw box structure generated in phase 1.
 * @returns The semantic queries keyed by sub-box title, or an error message.
 */
export async function generateSemanticQueriesAction(
  structure: RawBoxStructureResponse,
): Promise<
  { success: true; queries: Map<string, string> } | { error: string }
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

    const subBoxEntries: {
      title: string;
      boxType: string;
      description: string;
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
    methodology: mapQuadrant("methodology"),
    primaryMaterial: mapQuadrant("primaryMaterial"),
  };
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
 * Persists the boxes to the database in a single transaction and invalidates caches.
 *
 * @param boxes - The boxes payload to validate and persist.
 * @returns An onboarding action result with a success flag or an error message.
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
        .delete(boxRows)
        .where(
          and(
            eq(boxRows.matrixId, thesisMatrixId),
            ne(boxRows.boxType, "RELATED_THESES"),
          ),
        );

      const parentFlatIndices: number[] = [];
      for (let i = 0; i < validBoxes.length; i++) {
        if (validBoxes[i].parentId === null) {
          parentFlatIndices.push(i);
        }
      }

      const parentValues = parentFlatIndices.map((i) => ({
        matrixId: thesisMatrixId,
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
          .insert(boxRows)
          .values(parentValues)
          .returning({ id: boxRows.id });
      }

      const dbParentIdMap = new Map<number, number>();
      for (let j = 0; j < parentFlatIndices.length; j++) {
        const dbId = insertedParents[j]?.id;
        if (dbId !== undefined) {
          dbParentIdMap.set(parentFlatIndices[j], dbId);
        }
      }

      const childValues: (typeof boxRows.$inferInsert)[] = [];
      for (let i = 0; i < validBoxes.length; i++) {
        const box = validBoxes[i];
        if (box.parentId === null) continue;
        const mappedParentId = dbParentIdMap.get(box.parentId) ?? null;
        childValues.push({
          matrixId: thesisMatrixId,
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
        await tx.insert(boxRows).values(childValues);
      }
    });

    try {
      revalidateOnboardingPaths();
      updateTag(CACHE_TAGS.thesisBoxes);
    } catch {}

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
 * Legacy alias for persistBoxesAction.
 */
export const confirmBoxesAction = persistBoxesAction;

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
export const generateBoxesStructureAction = runBoxesPipelineAction;
