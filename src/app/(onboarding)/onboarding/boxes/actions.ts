"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { thesisBoxes } from "@/db/schema";
import { getSession, SESSION_ERROR_MSG } from "@/lib/session";
import { generateStructuredContent } from "@/lib/services/gemini";
import { GEMINI_MODEL, GEMINI_TEMPERATURE, GEMINI_SEED } from "@/lib/constants";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { updateTag } from "next/cache";
import { CACHE_TAGS, revalidateOnboardingPaths } from "@/lib/cache-tags";
import {
  buildThesisBoxGenerationSystemInstruction,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
  thesisBoxGenerationJsonSchema,
  type RawNestedResponse,
} from "@/lib/prompts/box-generation";
import { type OnboardingActionResult } from "@/lib/types";
import { mapToProductionShape } from "../_lib/box-mapper";

import {
  fetchThesisMatrix,
  fetchOriginalityReport,
} from "../_services/fetch-actions";

const RELATED_THESES_TITLE = "İlişkisel Tez Çalışmaları";

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
    relatedTheses: z.any().optional(),
  }),
);

/**
 * Generates the 5-quadrant epistemological box structure and semanticQuery
 * fields in a single Gemini 3.1 Flash Lite call. The nested API response is
 * flattened through the adapter and a RELATED_THESES box is appended from the
 * originality report.
 *
 * @returns The generated flat box array or a safe user-facing error message
 */
export async function generateBoxesStructureAction(): Promise<
  | { success: true; boxes: import("@/lib/types").GeminiThesisBox[] }
  | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix, report] = await Promise.all([
      fetchThesisMatrix(),
      fetchOriginalityReport(),
    ]);

    if (!matrix) return { error: "Thesis matrix not found." };

    log.info("box_structure_generation_start", {
      service: "boxes",
      data: {
        context: "Single-call box structure + semanticQuery (3.1 Flash Lite)",
      },
    });

    const geminiPrompt = buildThesisBoxGenerationPrompt({
      mainActors: matrix.mainActors,
      researchFocus: matrix.researchFocus,
      temporalScope: matrix.temporalScope,
      spatialScope: matrix.spatialScope,
      theoreticalFramework: matrix.theoreticalFramework,
      methodology: matrix.methodology,
      mainClaim: matrix.mainClaim,
    });

    const generationResult = await generateStructuredContent<RawNestedResponse>(
      GEMINI_MODEL,
      buildThesisBoxGenerationSystemInstruction(),
      geminiPrompt,
      thesisBoxGenerationJsonSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        zodSchema: thesisBoxGenerationSchema,
        temperature: GEMINI_TEMPERATURE,
        seed: GEMINI_SEED,
        thesisMatrix: matrix,
        payloadStage: "box_generation",
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { analysis, ...quadrantsOnly } = generationResult;
    const normalizedBoxes = mapToProductionShape(quadrantsOnly);

    // Populate the RELATED_THESES box with overlapping theses from the
    // originality report (already computed during risk analysis).
    const overlapTable = report?.tezaraResults?.overlapTable ?? [];
    normalizedBoxes.push({
      title: RELATED_THESES_TITLE,
      boxType: "RELATED_THESES",
      description: "Tez matrisiyle örtüşen sınırdaş akademik çalışmalar.",
      parentId: null,
      semanticQuery: null,
      subBoxes: [],
      concepts: [],
      foundationalQueries: [],
      relatedTheses: overlapTable.map((t) => {
        const isTwinCandidate = t.primaryBadge === "CRITICAL_OVERLAP";
        const explanation = t.analysisNote || "";
        return {
          title: t.title,
          author: t.author,
          university: t.university,
          year: t.year,
          thesisType: t.thesisType,
          department: t.department,
          primaryBadge: t.primaryBadge,
          badges: t.badges,
          analysisNote: t.analysisNote,
          explanation: isTwinCandidate
            ? `[İKİZ TEZ ADAYI] ${explanation}`
            : explanation,
          yokPdfUrl: t.yokPdfUrl,
        };
      }),
    });

    const parentCount = normalizedBoxes.filter(
      (b) => b.parentId === null,
    ).length;
    const childCount = normalizedBoxes.filter(
      (b) => b.parentId !== null,
    ).length;

    log.info("box_structure_generation_success", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: {
        parentCount,
        childCount,
        context: "Single call including semanticQuery",
      },
    });

    return { success: true, boxes: normalizedBoxes };
  } catch (err) {
    log.error("box_structure_generation_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error: "An unexpected error occurred while generating subject boxes.",
    };
  }
}

/**
 * Persists the generated (and user-edited) subject boxes to the thesis_boxes
 * table. Existing boxes are deleted and the flat hierarchy is re-inserted.
 *
 * @param boxes - The GeminiThesisBox array to persist
 * @returns Success or error response
 */
export async function confirmBoxesAction(
  boxes: unknown,
): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info("boxes_confirm_start", {
    service: "boxes",
    data: { context: "Persisting subject boxes" },
  });

  const parsed = confirmBoxesSchema.safeParse(boxes);
  if (!parsed.success) {
    log.error("boxes_confirm_validation_failed", {
      service: "boxes",
      error: parsed.error,
    });
    return { error: "Invalid box data received." };
  }

  const validBoxes = parsed.data;

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const matrix = await fetchThesisMatrix();

    if (!matrix) return { error: "Thesis matrix not found." };

    const thesisMatrixId = matrix.id;

    await db.transaction(async (tx) => {
      // Delete existing boxes
      await tx
        .delete(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

      // Step 1: Collect parent flat indices (original array positions)
      const parentFlatIndices: number[] = [];
      for (let i = 0; i < validBoxes.length; i++) {
        if (validBoxes[i].parentId === null) {
          parentFlatIndices.push(i);
        }
      }

      // Step 2: Insert parent boxes first (preserving flat order)
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

      // Step 3: Map original flat index → database ID
      // (child boxes reference the original flat array index in parentId)
      const dbParentIdMap = new Map<number, number>();
      for (let j = 0; j < parentFlatIndices.length; j++) {
        const dbId = insertedParents[j]?.id;
        if (dbId !== undefined) {
          dbParentIdMap.set(parentFlatIndices[j], dbId);
        }
      }

      // Step 4: Insert child boxes with correct FK parentId
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

    revalidateOnboardingPaths();
    updateTag(CACHE_TAGS.thesisBoxes);

    const parentCount = validBoxes.filter((b) => b.parentId === null).length;
    const childCount = validBoxes.filter((b) => b.parentId !== null).length;

    log.info("boxes_confirm_success", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: {
        parentCount,
        childCount,
        context: "Persisting subject boxes",
      },
    });
    return { success: true };
  } catch (err) {
    log.error("boxes_confirm_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
      data: { context: "Persisting subject boxes" },
    });
    return { error: "Failed to save subject boxes to the database." };
  }
}
