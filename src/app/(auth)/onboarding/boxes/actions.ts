"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, thesisBoxes, users, originalityReports } from "@/db/schema";
import { getSession } from "@/proxy";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import type { OnboardingActionResult, OnboardingFormData, OriginalityReportData, GeminiThesisBox } from "@/lib/types";

/**
 * Persists the generated subject boxes and associated onboarding data:
 * 1. Inserts/updates the thesis matrix in `thesis_matrices` table.
 * 2. Inserts/updates the jüri originality report in `originality_reports` table.
 * 3. Deletes existing and inserts new boxes in `thesis_boxes` table (hierarchically).
 *
 * NOTE: `users.onboarding_completed` is NOT set here. The Literature Review
 * step must be completed first; this flag will be set to `true` in the
 * final onboarding step (literature-review → finalize).
 *
 * Done atomically in a single Drizzle transaction.
 *
 * @param args - The onboarding data from Zustand store.
 * @returns Success response or throws error.
 */
export async function confirmBoxesAction(args: {
  formData: OnboardingFormData;
  approvedKeywords: string[];
  juryReport: OriginalityReportData;
  boxes: GeminiThesisBox[];
}): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info({
    step: "confirmBoxes",
    status: "START",
  });

  try {
    const session = await getSession();
    if (!session) {
      log.warn({
        step: "confirmBoxes",
        status: "FAILED",
        diagnostics: {
          errorCode: "AUTH_ERROR",
          message: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
        },
      });
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;
    const { formData, approvedKeywords, juryReport, boxes } = args;

    if (!formData || !juryReport || !boxes) {
      log.warn({
        step: "confirmBoxes",
        status: "FAILED",
        diagnostics: {
          errorCode: "VALIDATION_ERROR",
          message: "Eksik onboarding verisi.",
        },
      });
      return { error: "Eksik onboarding verisi." };
    }

    // Execute atomic transaction using Drizzle
    await db.transaction(async (tx) => {
      // 1. Write/upsert to thesis_matrices
      log.info({ step: "transaction_save_matrix", status: "START", service: "db" });
      const t0 = performance.now();
      const [matrix] = await tx
        .insert(thesisMatrices)
        .values({
          userId,
          studyTitle: formData.studyTitle,
          researchQuestion: formData.researchQuestion,
          mainClaim: formData.mainClaim,
          methodology: formData.methodology,
          theoreticalFramework: formData.theoreticalFramework,
          historicalSpatialLimits: formData.historicalSpatialLimits,
          keywords: approvedKeywords,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: thesisMatrices.userId,
          set: {
            studyTitle: formData.studyTitle,
            researchQuestion: formData.researchQuestion,
            mainClaim: formData.mainClaim,
            methodology: formData.methodology,
            theoreticalFramework: formData.theoreticalFramework,
            historicalSpatialLimits: formData.historicalSpatialLimits,
            keywords: approvedKeywords,
            updatedAt: new Date(),
          },
        })
        .returning({ id: thesisMatrices.id });
      log.info({ step: "transaction_save_matrix", status: "SUCCESS", metrics: { durationMs: performance.now() - t0 }, service: "db" });

      const thesisMatrixId = matrix.id;

      // 2. Write/upsert to originality_reports
      log.info({ step: "transaction_save_report", status: "START", service: "db" });
      const t1 = performance.now();
      await tx
        .insert(originalityReports)
        .values({
          userId,
          tavilyResults: juryReport.tavilyResults,
          tezaraResults: juryReport.tezaraResults,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: originalityReports.userId,
          set: {
            tavilyResults: juryReport.tavilyResults,
            tezaraResults: juryReport.tezaraResults,
            updatedAt: new Date(),
          },
        });
      log.info({ step: "transaction_save_report", status: "SUCCESS", metrics: { durationMs: performance.now() - t1 }, service: "db" });

      // 3. Write/upsert to thesis_boxes
      // Delete existing boxes first
      log.info({ step: "transaction_clear_boxes", status: "START", service: "db" });
      const t2 = performance.now();
      await tx
        .delete(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));
      log.info({ step: "transaction_clear_boxes", status: "SUCCESS", metrics: { durationMs: performance.now() - t2 }, service: "db" });

      // 3a. Insert parent boxes
      const parentValues = [
        {
          thesisMatrixId,
          parentId: null,
          category: "intro" as const,
          title: "Giriş ve Temel İddia",
          description: "Tezin temel iddiaları ve giriş çerçevesi.",
          theorists: [],
          concepts: [],
          queries: [],
        },
        {
          thesisMatrixId,
          parentId: null,
          category: "theory" as const,
          title: "Teorik Zemin",
          description: "Kuramsal çerçeve ve teorik altyapı kutuları.",
          theorists: [],
          concepts: [],
          queries: [],
        },
        {
          thesisMatrixId,
          parentId: null,
          category: "methodology" as const,
          title: "Yöntem Literatürü",
          description: "Metodoloji ve araştırma yöntemi kutuları.",
          theorists: [],
          concepts: [],
          queries: [],
        },
        {
          thesisMatrixId,
          parentId: null,
          category: "context" as const,
          title: "Tarihsel ve Mekânsal Bağlam",
          description: "Tarihsel sınırlar ve coğrafi/mekânsal bağlam kutuları.",
          theorists: [],
          concepts: [],
          queries: [],
        },
        {
          thesisMatrixId,
          parentId: null,
          category: "primary_source" as const,
          title: "Birincil Özneler ve Arşivler",
          description: "İncelenen birincil özneler, arşivler ve belgeler.",
          theorists: [],
          concepts: [],
          queries: [],
        },
      ];

      log.info({ step: "transaction_insert_parent_boxes", status: "START", service: "db" });
      const t3 = performance.now();
      const insertedParents = await tx
        .insert(thesisBoxes)
        .values(parentValues)
        .returning({ id: thesisBoxes.id, category: thesisBoxes.category });
      log.info({ step: "transaction_insert_parent_boxes", status: "SUCCESS", metrics: { durationMs: performance.now() - t3 }, service: "db" });

      const parentMap = new Map<string, number>();
      for (const parent of insertedParents) {
        parentMap.set(parent.category, parent.id);
      }

      // 3b. Map and insert child sub-boxes
      const subBoxValues = boxes.map((box) => {
        const parentId = parentMap.get(box.category);
        if (!parentId) {
          throw new Error(
            `Ebeveyn kutusu bulunamadı (kategori: ${box.category})`
          );
        }
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
        log.info({ step: "transaction_insert_child_boxes", status: "START", service: "db" });
        const t4 = performance.now();
        await tx.insert(thesisBoxes).values(subBoxValues);
        log.info({ step: "transaction_insert_child_boxes", status: "SUCCESS", metrics: { durationMs: performance.now() - t4 }, service: "db" });
      }

      // NOTE: `users.onboarding_completed` is NOT updated here.
      // The Literature Review step must be implemented first.
      // This flag will be set to `true` in the final step of the
      // complete onboarding flow (literature-review → finalize).
    });

    try {
      revalidatePath("/onboarding", "layout");
      revalidatePath("/", "layout");
    } catch (e) {
      log.info({
        step: "revalidate_path_skipped",
        status: "SUCCESS",
        diagnostics: {
          message: e instanceof Error ? e.message : String(e),
        },
      });
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(1) + "s";

    log.info({
      step: "confirmBoxes",
      status: "SUCCESS",
      metrics: {
        duration,
        outputRows: boxes.length,
      },
    });

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
    throw err; // Throw error to ensure Drizzle automatic rollback
  }
}


