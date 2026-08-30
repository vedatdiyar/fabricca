import { sql } from "drizzle-orm";
import { db } from "@/core/db";
import { positioning } from "@/core/db/schema";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";
import type { JuryAnalysisResult } from "./analysis";

/**
 * Persists the positioning report in an atomic database transaction and invalidates cache tags.
 *
 * @param userId - The ID of the authenticated user.
 * @param matrixId - The ID of the thesis matrix.
 * @param analysisResult - The full jury analysis result to persist.
 * @returns The saved database record.
 */
export async function savePositioningReportTransaction(
  userId: number,
  matrixId: number,
  analysisResult: JuryAnalysisResult,
) {
  const savedRecord = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(positioning)
      .values({
        userId,
        matrixId,
        globalStatus: analysisResult.globalStatus,
        gapAnalysisSummary: analysisResult.gapAnalysisSummary,
        recommendedTheses: [],
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: positioning.matrixId,
        set: {
          globalStatus: analysisResult.globalStatus,
          gapAnalysisSummary: analysisResult.gapAnalysisSummary,
          recommendedTheses: [],
          updatedAt: sql`now()`,
        },
      })
      .returning();

    return row;
  });

  try {
    invalidateOnboardingStepCache("positioning");
  } catch {
    // Ignore cache tag error if invoked outside Next.js request context
  }

  return savedRecord;
}
