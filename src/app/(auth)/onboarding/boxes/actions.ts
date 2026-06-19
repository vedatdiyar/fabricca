"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisBoxes } from "@/db/schema";
import { getSession } from "@/session";
import { generateStructuredContent } from "@/lib/gemini";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath, updateTag } from "next/cache";
import {
  buildThesisBoxGenerationSystemInstruction,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "@/lib/prompts";
import {
  BoxGenerationResponseSchema,
  type GeminiThesisBox,
  type OnboardingActionResult,
} from "@/lib/types";
import { fetchThesisMatrix } from "../_lib/fetch-actions";

/**
 * Generates subject boxes (boxes) via Gemini for the current user's thesis matrix.
 * Returns the generated boxes as JSON without writing to DB.
 *
 * @returns The generated thesis boxes array, or a user-safe error message
 */
export async function generateBoxesAction(): Promise<
  { success: true; boxes: GeminiThesisBox[] } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info("boxes_generate_start", {
    service: "boxes",
    data: { context: "Konu kutusu üretimi" },
  });

  try {
    const session = await getSession();
    if (!session)
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const matrix = await fetchThesisMatrix();
    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    const geminiPrompt = buildThesisBoxGenerationPrompt({
      studyTitle: matrix.studyTitle,
      researchQuestion: matrix.researchQuestion,
      mainClaim: matrix.mainClaim,
      theoreticalFramework: matrix.theoreticalFramework,
      methodology: matrix.methodology,
      dataStrategy: matrix.dataStrategy,
      historicalLimits: matrix.historicalLimits,
      spatialLimits: matrix.spatialLimits,
      analyticalFocus: matrix.analyticalFocus,
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

    const draftBoxes = generationResult.boxes || [];

    log.info("boxes_generate_success", {
      service: "boxes",
      durationMs: performance.now() - startTime,
      data: { count: draftBoxes.length, context: "Konu kutusu üretimi" },
    });

    return { success: true, boxes: draftBoxes };
  } catch (err) {
    log.error("boxes_generate_failed", {
      service: "boxes",
      error: err,
      data: { context: "Konu kutusu üretimi" },
    });
    return {
      error: "Konu kutuları oluşturulurken beklenmeyen bir hata oluştu.",
    };
  }
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
