"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, thesisBoxes } from "@/db/schema";
import { getSession } from "@/proxy";
import { createFlowId, Logger } from "@/lib/logger";
import type { EnhancedThesisData, OnboardingActionResult } from "@/lib/types";

/**
 * Updates the enriched thesis matrix in the database and cascades stale data.
 * Called when user clicks "Onayla ve İlerle" on the enrichment page.
 *
 * If the enriched data changed, it deletes downstream data
 * (originality_reports, thesis_boxes cascade library_resources)
 * to maintain consistency.
 *
 * @param data - The (possibly edited) enriched thesis data
 * @param hasChanges - Whether the user actually modified the data
 * @returns Success response or error
 */
export async function confirmEnhancedThesisAction(
  data: EnhancedThesisData,
): Promise<OnboardingActionResult & { needsRedirect?: boolean }> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info({ step: "confirm_enhanced_thesis", status: "START" });

  try {
    const session = await getSession();
    if (!session) {
      return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const userId = session.userId;

    // Always update thesis_matrices with the latest enriched data
    await db
      .insert(thesisMatrices)
      .values({
        userId,
        studyTitle: data.academicStudyTitle,
        researchQuestion: data.literatureResearchQuestion,
        mainClaim: data.refinedThesisClaim,
        methodology: data.academicMethodologyDesign,
        theoreticalFramework: data.conceptualTheoreticalInfrastructure,
        historicalSpatialLimits: data.historicalSpatialLimits,
        keywords: [],
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: thesisMatrices.userId,
        set: {
          studyTitle: data.academicStudyTitle,
          researchQuestion: data.literatureResearchQuestion,
          mainClaim: data.refinedThesisClaim,
          methodology: data.academicMethodologyDesign,
          theoreticalFramework: data.conceptualTheoreticalInfrastructure,
          historicalSpatialLimits: data.historicalSpatialLimits,
          updatedAt: new Date(),
        },
      });

    // Check if there is downstream stale data
    const [existingReport] = await db
      .select({ id: originalityReports.id })
      .from(originalityReports)
      .where(eq(originalityReports.userId, userId));

    // Ste stale data exists → signal client to show confirmation dialog
    if (existingReport) {
      return {
        success: true,
        needsRedirect: true,
      };
    }

    log.info({ step: "confirm_enhanced_thesis", status: "SUCCESS" });
    return { success: true };
  } catch (error) {
    log.error({ step: "confirm_enhanced_thesis", status: "FAILED", diagnostics: { errorCode: "CONFIRM_ENRICHED_THESIS_ERROR", message: error instanceof Error ? error.message : String(error) } });
    return { error: "Tez matrisi onaylanırken bir hata oluştu." };
  }
}

/**
 * Clears stale downstream data (originality_reports, thesis_boxes cascade)
 * after user confirms they want to proceed despite data loss.
 */
export async function clearOnboardingStaleDataAction(): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) return { error: "Oturum bulunamadı." };

    const userId = session.userId;

    await db.delete(originalityReports).where(eq(originalityReports.userId, userId));
    // thesis_boxes cascade deletes via thesis_matrices → thesis_boxes FK
    // But thesis_boxes references thesisMatrixId, not userId directly.
    // We need to find the matrix ID first.
    const [matrix] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, userId));

    if (matrix) {
      await db.delete(thesisBoxes).where(eq(thesisBoxes.thesisMatrixId, matrix.id));
    }

    log.info({ step: "clear_stale_data", status: "SUCCESS" });
    return { success: true };
  } catch (error) {
    log.error({ step: "clear_stale_data", status: "FAILED", error: String(error) });
    return { error: "Veri temizlenirken bir hata oluştu." };
  }
}
