"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, originalityReports, thesisBoxes } from "@/db/schema";
import { getSession } from "@/proxy";
import { createFlowId, Logger } from "@/lib/logger";
import type { EnhancedThesisData, OnboardingActionResult } from "@/lib/types";

/**
 * Saves the enriched thesis matrix and clears all downstream data
 * (originality_reports, thesis_boxes) so the user can re-run from this step.
 *
 * @param data - The enriched thesis data
 * @returns Success response or error
 */
export async function confirmEnhancedThesisAction(
  data: EnhancedThesisData,
): Promise<OnboardingActionResult> {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  log.info({ step: "confirm_enhanced_thesis", status: "START" });

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

    // Clear downstream data: originality_reports
    await db.delete(originalityReports).where(eq(originalityReports.userId, userId));

    // Clear downstream data: thesis_boxes (cascades to library_resources via FK)
    const [matrix] = await db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, userId));

    if (matrix) {
      await db.delete(thesisBoxes).where(eq(thesisBoxes.thesisMatrixId, matrix.id));
    }

    log.info({ step: "confirm_enhanced_thesis", status: "SUCCESS" });
    return { success: true };
  } catch (error) {
    log.error({ step: "confirm_enhanced_thesis", status: "FAILED", diagnostics: { errorCode: "CONFIRM_ENRICHED_THESIS_ERROR", message: error instanceof Error ? error.message : String(error) } });
    return { error: "Tez matrisi onaylanırken bir hata oluştu." };
  }
}


