"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { thesisBoxes } from "@/db/schema";
import { getSession } from "@/session";
import {
  generateStructuredContent,
  generateContentWithSearch,
} from "@/lib/gemini";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath, updateTag } from "next/cache";
import {
  buildThesisBoxGenerationSystemInstruction,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "@/lib/prompts/box-generation";
import {
  buildFoundationalQuerySystemInstruction,
  buildFoundationalQueryPrompt,
} from "@/lib/prompts/foundational-queries";
import {
  BoxGenerationResponseSchema,
  FinalBoxGenerationResponseSchema,
  FoundationalQuerySchema,
  type GeminiThesisBox,
  type FoundationalQuery,
  type OnboardingActionResult,
} from "@/lib/types";
import { fetchThesisMatrix } from "../_lib/fetch-actions";

/**
 * Two-step parallel hybrid pipeline for thesis box generation.
 *
 * Step 1 (Gemini 3.1 Flash Lite): Splits the thesis matrix into subject boxes
 * with empty foundationalQueries arrays (schema-locked JSON mode).
 *
 * Step 2 (Gemini 2.5 Flash + Search Grounding): For each box, runs a parallel
 * Google Search to find 3-4 real foundational academic works, then deduplicates
 * across all boxes and validates with the final strict schema.
 *
 * @returns The fully populated thesis boxes array, or a user-safe error message
 */
export async function generateBoxesAction(): Promise<
  { success: true; boxes: GeminiThesisBox[] } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const pipelineStart = performance.now();

  try {
    const session = await getSession();
    if (!session)
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const matrix = await fetchThesisMatrix();
    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Box splitting via Gemini 3.1 Flash Lite (structured JSON)
    // ─────────────────────────────────────────────────────────────
    log.info("step1_split_start", {
      service: "boxes",
      data: { context: "Kutu bölme (3.1 Flash Lite)" },
    });

    const step1Start = performance.now();
    const geminiPrompt = buildThesisBoxGenerationPrompt({
      studyTitle: matrix.studyTitle,
      researchQuestion: matrix.researchQuestion,
      mainClaim: matrix.mainClaim,
      theoreticalFramework: matrix.theoreticalFramework,
      methodology: matrix.methodology,
      researchScope: matrix.researchScope,
    });

    const generationResult = await generateStructuredContent<{
      boxes: GeminiThesisBox[];
    }>(
      "gemini-3.1-flash-lite",
      buildThesisBoxGenerationSystemInstruction(),
      geminiPrompt,
      thesisBoxGenerationSchema,
      log,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        zodSchema: BoxGenerationResponseSchema,
      },
    );

    const partialBoxes = generationResult.boxes.map((b) => ({
      ...b,
      foundationalQueries: [] as FoundationalQuery[],
    }));

    log.info("step1_split_success", {
      service: "boxes",
      durationMs: performance.now() - step1Start,
      data: { count: partialBoxes.length, context: "Kutu bölme" },
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Foundational query enrichment via Gemini 2.5 Flash + Search
    // ─────────────────────────────────────────────────────────────
    const thesisCtx = {
      studyTitle: matrix.studyTitle,
      theoreticalFramework: matrix.theoreticalFramework,
      researchScope: matrix.researchScope,
    };

    log.info("step2_search_start", {
      service: "boxes",
      data: {
        boxCount: partialBoxes.length,
        context: "Paralel literatür arama (2.5 Flash)",
      },
    });

    const step2Start = performance.now();

    const enrichedBoxes: GeminiThesisBox[] = await Promise.all(
      partialBoxes.map(async (box) => {
        const searchPrompt = buildFoundationalQueryPrompt(box, thesisCtx);

        try {
          const queries = await generateContentWithSearch<FoundationalQuery[]>(
            "gemini-2.5-flash",
            buildFoundationalQuerySystemInstruction(),
            searchPrompt,
            log,
            {
              thinkingBudget: 2048,
              temperature: 0.7,
              topP: 0.95,
              zodSchema: z.array(FoundationalQuerySchema),
            },
          );

          return {
            ...box,
            foundationalQueries: Array.isArray(queries) ? queries : [],
          };
        } catch {
          return { ...box, foundationalQueries: [] };
        }
      }),
    );

    log.info("step2_search_success", {
      service: "boxes",
      durationMs: performance.now() - step2Start,
      data: {
        boxCount: enrichedBoxes.length,
        context: "Paralel literatür arama",
      },
    });

    // ─────────────────────────────────────────────────────────────
    // POST-PROCESSING: Global deduplication + final validation
    // ─────────────────────────────────────────────────────────────
    const dedupedBoxes = deduplicateFoundationalQueries(enrichedBoxes);

    const validationResult = FinalBoxGenerationResponseSchema.safeParse({
      boxes: dedupedBoxes,
    });

    if (!validationResult.success) {
      log.error("step2_validation_failed", {
        service: "boxes",
        error: new Error(validationResult.error.message),
        data: {
          issues: validationResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
          context: "Final validasyon",
        },
      });
      return {
        error:
          "Kutulardaki kurucu literatür verisi doğrulamayı geçemedi. Lütfen tekrar deneyin.",
      };
    }

    log.info("pipeline_complete", {
      service: "boxes",
      durationMs: performance.now() - pipelineStart,
      data: {
        boxCount: dedupedBoxes.length,
        context: "İki aşamalı kutu üretimi tamamlandı",
      },
    });

    return { success: true, boxes: dedupedBoxes };
  } catch (err) {
    log.error("pipeline_failed", {
      service: "boxes",
      error: err,
      data: { context: "Kutu üretim pipeline hatası" },
    });
    return {
      error: "Konu kutuları oluşturulurken beklenmeyen bir hata oluştu.",
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
    if (!session)
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const matrix = await fetchThesisMatrix();
    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    const thesisMatrixId = matrix.id;

    await db.transaction(async (tx) => {
      // Delete existing boxes
      await tx
        .delete(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

      // Insert all boxes as flat
      const boxValues = boxes.map((box) => ({
        thesisMatrixId,
        title: box.title,
        boxType: box.boxType,
        description: box.description || "",
        semanticSearchBlock: box.semanticSearchBlock || "",
        foundationalQueries: box.foundationalQueries || [],
        concepts: box.concepts || [],
      }));

      if (boxValues.length > 0) {
        await tx.insert(thesisBoxes).values(boxValues);
      }
    });

    revalidatePath("/onboarding", "layout");
    revalidatePath("/onboarding/literature-review");
    revalidatePath("/", "layout");

    updateTag("thesis-boxes");

    log.info("boxes_confirm_success", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: { count: boxes.length, context: "Konu kutusu kaydetme" },
    });
    return { success: true };
  } catch (err) {
    log.error("boxes_confirm_failed", {
      service: "boxes",
      error: err,
      data: { context: "Konu kutusu kaydetme" },
    });
    return { error: "Konu kutuları kaydedilirken bir hata oluştu." };
  }
}
