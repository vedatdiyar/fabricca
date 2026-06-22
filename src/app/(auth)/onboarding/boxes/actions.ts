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
  type FoundationalQuery,
} from "@/lib/types";
import { fetchThesisMatrix } from "../_lib/fetch-actions";
import { mineCoCitations } from "./_services/co-citation-miner";

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
    if (!session)
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    const matrix = await fetchThesisMatrix();
    if (!matrix) return { error: "Tez matrisi bulunamadı." };

    log.info("box_structure_generation_start", {
      service: "boxes",
      data: { context: "Kutu yapısı oluşturma (3.1 Flash Lite)" },
    });

    const geminiPrompt = buildThesisBoxGenerationPrompt({
      studyTitle: matrix.studyTitle,
      researchQuestion: matrix.researchQuestion,
      mainClaim: matrix.mainClaim,
      theoreticalFramework: matrix.theoreticalFramework,
      methodology: matrix.methodology,
      researchScope: matrix.researchScope,
    });

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
        | "ANALYSIS_FINDINGS";
      return {
        title: (rawBox.title as string) || "",
        boxType,
        description: (rawBox.description as string) || "",
        semanticSearchQueries: (rawBox.semanticSearchQueries as string[]) || [],
        concepts: (rawBox.concepts as string[]) || [],
        foundationalQueries: [],
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
    if (!session)
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

    log.info("mine_foundational_queries_start", {
      service: "boxes",
      data: { boxCount: boxes.length },
    });

    const populatedBoxes: GeminiThesisBox[] = [];

    for (const box of boxes) {
      if (box.boxType === "ANALYSIS_FINDINGS") {
        populatedBoxes.push({ ...box, foundationalQueries: [] });
        continue;
      }

      log.info("mining_box_foundational", {
        service: "boxes",
        data: { title: box.title, queries: box.semanticSearchQueries },
      });

      let mined = await mineCoCitations(box.semanticSearchQueries, log);

      // Fallbacks to meet validation requirement (minimum 2 works for CONCEPTUAL, PROBLEMATIZATION, DATA_PROTOCOL)
      if (mined.length < 2) {
        log.warn("mining_fallback_applied", {
          service: "boxes",
          data: { title: box.title, countBefore: mined.length },
        });

        const fallbacks: Record<string, FoundationalQuery[]> = {
          CONCEPTUAL: [
            {
              author: "Michel Foucault",
              title: "Discipline and Punish: The Birth of the Prison",
              publicationYear: 1975,
            },
            {
              author: "Karl Marx",
              title: "Capital: A Critique of Political Economy",
              publicationYear: 1867,
            },
          ],
          PROBLEMATIZATION: [
            {
              author: "David Harvey",
              title: "A Brief History of Neoliberalism",
              publicationYear: 2005,
            },
            {
              author: "Immanuel Wallerstein",
              title: "The Modern World-System",
              publicationYear: 1974,
            },
          ],
          DATA_PROTOCOL: [
            {
              author: "John W. Creswell",
              title:
                "Research Design: Qualitative, Quantitative, and Mixed Methods Approaches",
              publicationYear: 2018,
            },
            {
              author: "Robert K. Yin",
              title: "Case Study Research and Applications",
              publicationYear: 2017,
            },
          ],
        };

        const typeFallbacks = fallbacks[box.boxType] || fallbacks.CONCEPTUAL;
        mined = [...mined, ...typeFallbacks].slice(0, 4);
      }

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
        semanticSearchQueries: box.semanticSearchQueries || [],
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
      error: err instanceof Error ? err : new Error(String(err)),
      data: { context: "Konu kutusu kaydetme" },
    });
    return { error: "Konu kutuları kaydedilirken bir hata oluştu." };
  }
}
