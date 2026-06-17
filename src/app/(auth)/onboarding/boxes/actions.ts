"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisBoxes } from "@/db/schema";
import { getSession } from "@/proxy";
import { generateStructuredContent } from "@/lib/gemini";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import {
  buildThesisBoxGenerationSystemInstruction,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "@/lib/prompts";
import type { GeminiThesisBox, OnboardingActionResult } from "@/lib/types";
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

  log.info({ step: "generateBoxes", status: "START", service: "boxes" });

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
      methodology: matrix.methodology,
      theoreticalFramework: matrix.theoreticalFramework,
      historicalSpatialLimits: matrix.historicalSpatialLimits,
    });

    const generationResult = await generateStructuredContent<{
      boxes: GeminiThesisBox[];
    }>(
      "gemini-3.1-flash-lite",
      buildThesisBoxGenerationSystemInstruction(),
      geminiPrompt,
      thesisBoxGenerationSchema,
      log,
      { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } },
    );

    const draftBoxes = generationResult.boxes || [];

    log.info({ step: "generateBoxes", status: "SUCCESS", service: "boxes" });

    return { success: true, boxes: draftBoxes };
  } catch (err) {
    log.error({
      step: "generateBoxes",
      status: "FAILED",
      service: "boxes",
      diagnostics: {
        errorCode: "SYSTEM_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
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

  log.info({ step: "confirmBoxes", status: "START", service: "boxes" });

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

    log.info({ step: "confirmBoxes", status: "SUCCESS", service: "boxes" });
    return { success: true };
  } catch (err) {
    log.error({
      step: "confirmBoxes",
      status: "FAILED",
      service: "boxes",
      diagnostics: {
        errorCode: "TRANSACTION_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return { error: "Konu kutuları kaydedilirken bir hata oluştu." };
  }
}
