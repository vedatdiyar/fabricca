"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisBoxes, thesisMatrices } from "@/db/schema";
import { getSession } from "@/proxy";
import { generateStructuredContent } from "@/lib/gemini";
import { ThinkingLevel } from "@google/genai";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import {
  THESIS_BOX_GENERATION_SYSTEM_INSTRUCTION,
  buildThesisBoxGenerationPrompt,
  thesisBoxGenerationSchema,
} from "@/lib/prompts";
import { searchWikipediaTheorist } from "@/lib/wikipedia";
import type { GeminiThesisBox, OnboardingActionResult } from "@/lib/types";
import { fetchThesisMatrix } from "../lib/fetch-actions";

/**
 * Generates subject boxes (boxes) via Gemini for the current user's thesis matrix.
 * Returns the generated boxes as JSON without writing to DB.
 */
export async function generateBoxesAction(): Promise<
  { success: true; boxes: GeminiThesisBox[] } | { error: string }
> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info({ step: "generateBoxes", status: "START" });

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
      THESIS_BOX_GENERATION_SYSTEM_INSTRUCTION,
      geminiPrompt,
      thesisBoxGenerationSchema,
      log,
      { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
    );

    const draftBoxes = generationResult.boxes || [];

    // Wikipedia concurrent cross-check for theorists
    await Promise.all(
      draftBoxes.map(async (box) => {
        const theorists = box.theorists || [];
        if (theorists.length === 0) return;
        const verificationPromises = theorists.map(async (theoristName) => {
          try {
            const wikiResult = await searchWikipediaTheorist(
              theoristName,
              box.category,
              log,
            );
            if (wikiResult) return theoristName;
          } catch {
            /* skip unverifiable */
          }
          return null;
        });
        const verificationResults = await Promise.all(verificationPromises);
        box.theorists = verificationResults.filter(
          (name): name is string => name !== null,
        );
      }),
    );

    log.info({ step: "generateBoxes", status: "SUCCESS" });

    return { success: true, boxes: draftBoxes };
  } catch (err) {
    log.error({
      step: "generateBoxes",
      status: "FAILED",
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
 * Deletes existing boxes for the matrix first, then inserts parent + child hierarchy.
 */
export async function confirmBoxesAction(
  boxes: GeminiThesisBox[],
): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info({ step: "confirmBoxes", status: "START" });

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

      // Insert parent boxes
      const parentValues = [
        {
          thesisMatrixId,
          parentId: null as number | null,
          category: "intro" as const,
          title: "Giriş ve Temel İddia",
          description: "Tezin temel iddiaları ve giriş çerçevesi.",
          theorists: [],
          concepts: [],
          queries: [],
        },
        {
          thesisMatrixId,
          parentId: null as number | null,
          category: "theory" as const,
          title: "Teorik Zemin",
          description: "Kuramsal çerçeve ve teorik altyapı kutuları.",
          theorists: [],
          concepts: [],
          queries: [],
        },
        {
          thesisMatrixId,
          parentId: null as number | null,
          category: "methodology" as const,
          title: "Yöntem Literatürü",
          description: "Metodoloji ve araştırma yöntemi kutuları.",
          theorists: [],
          concepts: [],
          queries: [],
        },
        {
          thesisMatrixId,
          parentId: null as number | null,
          category: "context" as const,
          title: "Tarihsel ve Mekânsal Bağlam",
          description: "Tarihsel sınırlar ve coğrafi/mekânsal bağlam kutuları.",
          theorists: [],
          concepts: [],
          queries: [],
        },
        {
          thesisMatrixId,
          parentId: null as number | null,
          category: "primary_source" as const,
          title: "Birincil Özneler ve Arşivler",
          description: "İncelenen birincil özneler, arşivler ve belgeler.",
          theorists: [],
          concepts: [],
          queries: [],
        },
      ];

      const insertedParents = await tx
        .insert(thesisBoxes)
        .values(parentValues)
        .returning({ id: thesisBoxes.id, category: thesisBoxes.category });

      const parentMap = new Map<string, number>();
      for (const parent of insertedParents) {
        parentMap.set(parent.category, parent.id);
      }

      // Insert child sub-boxes
      const subBoxValues = boxes.map((box) => {
        const parentId = parentMap.get(box.category);
        if (!parentId)
          throw new Error(
            `Ebeveyn kutusu bulunamadı (kategori: ${box.category})`,
          );
        return {
          thesisMatrixId,
          parentId,
          category: box.category,
          title: box.title,
          description: box.description || "",
          theorists: box.theorists || [],
          concepts: box.concepts || [],
          queries: box.queries || [],
        };
      });

      if (subBoxValues.length > 0) {
        await tx.insert(thesisBoxes).values(subBoxValues);
      }
    });

    revalidatePath("/onboarding", "layout");
    revalidatePath("/", "layout");

    log.info({ step: "confirmBoxes", status: "SUCCESS" });
    return { success: true };
  } catch (err) {
    log.error({
      step: "confirmBoxes",
      status: "FAILED",
      diagnostics: {
        errorCode: "TRANSACTION_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return { error: "Konu kutuları kaydedilirken bir hata oluştu." };
  }
}
