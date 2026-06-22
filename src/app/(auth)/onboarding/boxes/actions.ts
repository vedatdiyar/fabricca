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
} from "@/lib/prompts/box-generation";
import {
  BoxGenerationResponseSchema,
  FinalBoxGenerationResponseSchema,
  type GeminiThesisBox,
  type OnboardingActionResult,
} from "@/lib/types";
import { fetchThesisMatrix } from "../_lib/fetch-actions";

/**
 * Sequential single-step pipeline for thesis box and foundational queries generation.
 *
 * Invokes Gemini 3.1 Flash Lite (structured JSON mode) to split the thesis matrix
 * into subject boxes and generate 2 to 4 real seminal academic works for each box at the same time.
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
    // SINGLE STEP: Box splitting & Foundational Works via Gemini 3.1 Flash Lite (structured JSON)
    // ─────────────────────────────────────────────────────────────
    log.info("box_generation_start", {
      service: "boxes",
      data: { context: "Kutu ve kurucu eser üretme (3.1 Flash Lite)" },
    });

    const stepStart = performance.now();
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

    const rawBoxes = generationResult.boxes;

    // Ensure all fields are normalized and validated correctly
    const normalizedBoxes = rawBoxes.map((box) => {
      const rawBox = box as GeminiThesisBox & { type?: string };
      const boxType = rawBox.boxType || rawBox.type;
      return {
        title: rawBox.title || "",
        boxType: boxType as
          | "PROBLEMATIZATION"
          | "CONCEPTUAL"
          | "DATA_PROTOCOL"
          | "ANALYSIS_FINDINGS",
        description: rawBox.description || "",
        semanticSearchBlock: rawBox.semanticSearchBlock || "",
        concepts: rawBox.concepts || [],
        foundationalQueries:
          boxType === "ANALYSIS_FINDINGS"
            ? []
            : rawBox.foundationalQueries || [],
      };
    });

    log.info("box_generation_success", {
      service: "boxes",
      durationMs: performance.now() - stepStart,
      data: {
        count: normalizedBoxes.length,
        context: "Kutu ve kurucu eser üretme",
      },
    });

    // ─────────────────────────────────────────────────────────────
    // POST-PROCESSING: Global deduplication + final validation
    // ─────────────────────────────────────────────────────────────
    const dedupedBoxes = deduplicateFoundationalQueries(normalizedBoxes);

    const validationResult = FinalBoxGenerationResponseSchema.safeParse({
      boxes: dedupedBoxes,
    });

    if (!validationResult.success) {
      log.error("box_generation_validation_failed", {
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
        context: "Kutu ve kurucu eser üretimi tamamlandı",
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

    return { ...box, boxType: box.boxType, foundationalQueries: uniqueQueries };
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
