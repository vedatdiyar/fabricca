"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisBoxes, libraryResources } from "@/db/schema";
import { getSession } from "@/session";
import { generateStructuredContent } from "@/lib/gemini";
import { SESSION_ERROR_MSG } from "@/lib/constants/session";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { updateTag } from "next/cache";
import { CACHE_TAGS, revalidateOnboardingPaths } from "@/lib/cache-tags";
import {
  buildThesisBoxGenerationSystemInstruction,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "@/lib/prompts/box-generation";
import {
  BoxGenerationResponseSchema,
  FinalBoxGenerationResponseSchema,
  type GeminiThesisBox,
  type OnboardingActionResult,
} from "@/lib/types";
import type { NewLibraryResource } from "@/db/schema";
import {
  fetchThesisMatrix,
  fetchOriginalityReport,
} from "../_lib/fetch-actions";
import { mineCoCitations } from "../_services/co-citation-miner";

/**
 * Step 1: Generates the boxes structure (without foundational queries) using Gemini 3.1 Flash Lite.
 *
 * @returns The structured boxes array (with empty foundationalQueries), or a user-safe error message
 */
export async function generateBoxesStructureAction(): Promise<
  { success: true; boxes: GeminiThesisBox[] } | { error: string }
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

    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    // Extract overlapping theses from the originality report for Gemini context
    const overlapTheses =
      report?.tezaraResults?.overlapTable?.map((t) => ({
        id: t.id,
        title: t.title,
        author: t.author,
        axes: {
          subject: t.axes.subject,
          theory: t.axes.theory,
          methodology: t.axes.methodology,
        },
      })) ?? [];

    log.info("box_structure_generation_start", {
      service: "boxes",
      data: {
        context: "Kutu yapısı oluşturma (3.1 Flash Lite)",
        overlapThesisCount: overlapTheses.length,
      },
    });

    const geminiPrompt = buildThesisBoxGenerationPrompt(
      {
        studyTitle: matrix.studyTitle,
        researchQuestion: matrix.researchQuestion,
        mainClaim: matrix.mainClaim,
        theoreticalFramework: matrix.theoreticalFramework,
        methodology: matrix.methodology,
        researchScope: matrix.researchScope,
      },
      overlapTheses,
    );

    const generationResult = await generateStructuredContent<{
      boxes: unknown[];
    }>(
      "gemini-3.1-flash-lite",
      buildThesisBoxGenerationSystemInstruction(),
      geminiPrompt,
      thesisBoxGenerationSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        zodSchema: BoxGenerationResponseSchema,
        temperature: 1.0,
        seed: 42,
      },
    );

    const rawBoxes = generationResult.boxes || [];

    // Normalize generated boxes, initializing empty foundationalQueries
    const normalizedBoxes: GeminiThesisBox[] = rawBoxes.map((box) => {
      const rawBox = box as Record<string, unknown>;
      const boxType = (rawBox.boxType || rawBox.type) as
        | "PROBLEMATIZATION"
        | "CONCEPTUAL"
        | "DATA_PROTOCOL"
        | "PRIMARY_MATERIAL";
      return {
        title: (rawBox.title as string) || "",
        boxType,
        description: (rawBox.description as string) || "",
        semanticSearchQueries: (rawBox.semanticSearchQueries as string[]) || [],
        concepts: (rawBox.concepts as string[]) || [],
        foundationalQueries: [],
        mappedThesisIds: (rawBox.mappedThesisIds as number[]) || [],
      };
    });

    log.info("box_structure_generation_success", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: {
        count: normalizedBoxes.length,
      },
    });

    return { success: true, boxes: normalizedBoxes };
  } catch (err) {
    log.error("box_structure_generation_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error: "Konu kutuları oluşturulurken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Step 2: Mines OpenAlex for foundational queries based on the box semantic queries.
 *
 * @param boxes - The structured box array from Step 1
 * @returns The populated boxes array, or a user-safe error message
 */
export async function mineFoundationalQueriesAction(
  boxes: GeminiThesisBox[],
): Promise<{ success: true; boxes: GeminiThesisBox[] } | { error: string }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    log.info("mine_foundational_queries_start", {
      service: "boxes",
      data: { boxCount: boxes.length },
    });

    const populatedBoxes: GeminiThesisBox[] = [];

    for (const box of boxes) {
      if (box.boxType === "PRIMARY_MATERIAL") {
        populatedBoxes.push({ ...box, foundationalQueries: [] });
        continue;
      }

      log.info("mining_box_foundational", {
        service: "boxes",
        data: { title: box.title, queries: box.semanticSearchQueries },
      });

      const mined = await mineCoCitations(box.semanticSearchQueries, log);

      populatedBoxes.push({
        ...box,
        foundationalQueries: mined,
      });
    }

    // Deduplicate across all boxes
    const dedupedBoxes = deduplicateFoundationalQueries(populatedBoxes);

    // Final validation
    const validationResult = FinalBoxGenerationResponseSchema.safeParse({
      boxes: dedupedBoxes,
    });

    if (!validationResult.success) {
      log.error("box_mining_validation_failed", {
        service: "boxes",
        error: new Error(validationResult.error.message),
        data: {
          issues: validationResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      });
      return {
        error: "Kutulardaki kurucu literatür verisi doğrulamayı geçemedi.",
      };
    }

    log.info("mine_foundational_queries_complete", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: { count: dedupedBoxes.length },
    });

    return { success: true, boxes: dedupedBoxes };
  } catch (err) {
    log.error("mine_foundational_queries_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return {
      error: "Kurucu eserler aranırken beklenmeyen bir hata oluştu.",
    };
  }
}

/**
 * Removes duplicate foundational queries across all boxes based on
 * author+title key. If a work was already assigned to an earlier box,
 * it is filtered out from subsequent boxes.
 */
function deduplicateFoundationalQueries(
  boxes: GeminiThesisBox[],
): GeminiThesisBox[] {
  const seen = new Set<string>();

  return boxes.map((box) => {
    const uniqueQueries = box.foundationalQueries.filter((q) => {
      const key = `${q.author}|${q.title}`.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    return { ...box, foundationalQueries: uniqueQueries };
  });
}

/**
 * Persists the generated (and possibly user-edited) subject boxes to thesis_boxes.
 * Deletes existing boxes for the matrix first, then inserts flat hierarchy.
 * After boxes are written, inserts Gemini-mapped overlapping theses from the
 * originality report into library_resources using index-based box mapping.
 *
 * @param boxes - Array of GeminiThesisBox to persist
 * @returns Success or error response
 */
export async function confirmBoxesAction(
  boxes: GeminiThesisBox[],
): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info("boxes_confirm_start", {
    service: "boxes",
    data: { context: "Konu kutusu kaydetme" },
  });

  try {
    const session = await getSession();
    if (!session) return { error: SESSION_ERROR_MSG };

    const [matrix, report] = await Promise.all([
      fetchThesisMatrix(),
      fetchOriginalityReport(),
    ]);

    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    const thesisMatrixId = matrix.id;
    const overlapTable = report?.tezaraResults?.overlapTable ?? [];
    const overlapMap = new Map(overlapTable.map((t) => [t.id, t]));

    await db.transaction(async (tx) => {
      // Delete existing boxes
      await tx
        .delete(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

      // Insert all boxes as flat with RETURNING to capture generated IDs
      const boxValues = boxes.map((box) => ({
        thesisMatrixId,
        title: box.title,
        boxType: box.boxType,
        description: box.description || "",
        semanticSearchQueries: box.semanticSearchQueries || [],
        foundationalQueries: box.foundationalQueries || [],
        concepts: box.concepts || [],
      }));

      let insertedBoxes: { id: number }[] = [];

      if (boxValues.length > 0) {
        insertedBoxes = await tx
          .insert(thesisBoxes)
          .values(boxValues)
          .returning({ id: thesisBoxes.id });
      }

      // Index-based thesis mapping: boxes[i].mappedThesisIds → insertedBoxes[i].id
      const libraryValues: NewLibraryResource[] = [];

      for (let i = 0; i < boxes.length; i++) {
        const thesisIds = boxes[i].mappedThesisIds ?? [];
        if (thesisIds.length === 0) continue;

        const boxId = insertedBoxes[i]?.id;
        if (!boxId) continue;

        for (const thesisId of thesisIds) {
          const thesis = overlapMap.get(thesisId);
          if (!thesis) {
            log.warn("thesis_mapping_skip", {
              service: "boxes",
              data: {
                thesisId,
                boxIndex: i,
                reason: "Tez overlapTable içinde bulunamadı",
              },
            });
            continue;
          }

          libraryValues.push({
            thesisBoxId: boxId,
            title: thesis.title,
            abstract: null,
            url: thesis.yokPdfUrl ?? null,
            doi: null,
            publisher: thesis.university ?? null,
            publicationYear: thesis.year,
            authors: [thesis.author],
            isRead: false,
            isFoundational: false,
            relevanceScore: 0.99,
          });
        }
      }

      if (libraryValues.length > 0) {
        await tx
          .insert(libraryResources)
          .values(libraryValues)
          .onConflictDoNothing();
      }
    });

    revalidateOnboardingPaths();
    updateTag(CACHE_TAGS.thesisBoxes);

    log.info("boxes_confirm_success", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: {
        count: boxes.length,
        mappedThesisCount: boxes.reduce(
          (sum, b) => sum + (b.mappedThesisIds?.length ?? 0),
          0,
        ),
        context: "Konu kutusu kaydetme",
      },
    });
    return { success: true };
  } catch (err) {
    log.error("boxes_confirm_failed", {
      service: "boxes",
      error: err instanceof Error ? err : new Error(String(err)),
      data: { context: "Konu kutusu kaydetme" },
    });
    return { error: "Konu kutuları kaydedilirken bir hata oluştu." };
  }
}
