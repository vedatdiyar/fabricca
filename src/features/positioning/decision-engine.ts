import { sql } from "drizzle-orm";
import { db } from "@/db";
import { positioning } from "@/db/schema";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";
import type {
  PositioningMatrixInput,
  RecommendedThesisItem,
} from "./validation";
import type { JuryAnalysisResult } from "./analysis";

/**
 * Persists the positioning report within a transaction and invalidates the step cache.
 *
 * @param userId - The id of the user the report belongs to.
 * @param input - The validated positioning matrix input.
 * @param analysisResult - The jury analysis result to persist.
 * @returns The saved positioning report record.
 */
export async function savePositioningReportTransaction(
  userId: number,
  matrixId: number,
  analysisResult: JuryAnalysisResult,
) {
  const formattedRecommendedTheses: RecommendedThesisItem[] =
    analysisResult.recommendedTheses.map((t) => ({
      id: String(t.externalThesisId),
      externalThesisId: String(t.externalThesisId),
      title: t.title,
      author: t.author,
      year: t.year,
      university: t.university,
      contributionArea: t.contributionArea,
      relevanceReason: t.relevanceReason,
      doi: t.doi,
      thesisType: t.thesisType,
    }));

  const savedRecord = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(positioning)
      .values({
        userId,
        matrixId,
        globalStatus: analysisResult.globalStatus,
        gapAnalysisSummary: analysisResult.gapAnalysisSummary,
        recommendedTheses: formattedRecommendedTheses,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: positioning.matrixId,
        set: {
          globalStatus: analysisResult.globalStatus,
          gapAnalysisSummary: analysisResult.gapAnalysisSummary,
          recommendedTheses: formattedRecommendedTheses,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    return row;
  });

  invalidateOnboardingStepCache("positioning");

  return savedRecord;
}
