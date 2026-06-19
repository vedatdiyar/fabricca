"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, thesisBoxes } from "@/db/schema";
import { getSession } from "@/session";
import { createFlowId, Logger } from "@/lib/logger";
import { revalidatePath, updateTag } from "next/cache";
import type { EnhancedThesisData, OnboardingActionResult } from "@/lib/types";

/**
 * Saves the enriched thesis matrix and clears all downstream data
 * (originality_reports, thesis_boxes) so the user can re-run from this step.
 *
 * @param data - The enriched thesis data
 * @returns Onboarding action result indicating success or an error message
 */
export async function confirmEnhancedThesisAction(
  data: EnhancedThesisData,
): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);
  const startTime = performance.now();

  log.info("enrichment_confirm_start", {
    service: "enrichment",
    data: { context: "Zenginleştirilmiş matris onayı" },
  });

  try {
    const session = await getSession();
    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;

    // Upsert matrix
    await db
      .insert(thesisMatrices)
      .values({
        userId,
        studyTitle: data.academicStudyTitle,
        researchQuestion: data.literatureResearchQuestion,
        mainClaim: data.refinedThesisClaim,
        theoreticalFramework: data.conceptualTheoreticalInfrastructure,
        methodology: data.academicMethodologyDesign,
        dataStrategy: data.dataStrategy,
        historicalLimits: data.historicalLimits,
        spatialLimits: data.spatialLimits,
        analyticalFocus: data.analyticalFocus,
        keywords: [],
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: thesisMatrices.userId,
        set: {
          studyTitle: data.academicStudyTitle,
          researchQuestion: data.literatureResearchQuestion,
          mainClaim: data.refinedThesisClaim,
          theoreticalFramework: data.conceptualTheoreticalInfrastructure,
          methodology: data.academicMethodologyDesign,
          dataStrategy: data.dataStrategy,
          historicalLimits: data.historicalLimits,
          spatialLimits: data.spatialLimits,
          analyticalFocus: data.analyticalFocus,
          updatedAt: sql`now()`,
        },
      });

    // Clear downstream data: originality_reports
    await db
      .delete(originalityReports)
      .where(eq(originalityReports.userId, userId));

    // Clear downstream data: thesis_boxes (cascades to library_resources via FK)
    const [matrix] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, userId));

    if (matrix) {
      await db
        .delete(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, matrix.id));
    }

    revalidatePath("/onboarding/matrix");
    revalidatePath("/onboarding/enrichment");
    revalidatePath("/onboarding/risk");

    updateTag("thesis-matrix");
    updateTag("originality-report");
    updateTag("thesis-boxes");

    log.info("enrichment_confirm_success", {
      service: "enrichment",
      durationMs: performance.now() - startTime,
      data: { resultCount: 1, context: "Zenginleştirilmiş matris onayı" },
    });
    return { success: true };
  } catch (error) {
    log.error("enrichment_confirm_failed", {
      service: "enrichment",
      error,
      data: { context: "Zenginleştirilmiş matris onayı" },
    });
    return { error: "Tez matrisi onaylanırken bir hata oluştu." };
  }
}
