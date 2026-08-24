import { sql } from "drizzle-orm";
import { db } from "@/core/db";
import { positioning } from "@/core/db/schema";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";
import type { RecommendedThesisItem } from "./validation";
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
  const formattedRecommendedTheses: RecommendedThesisItem[] =
    analysisResult.recommendedTheses.map((t) => ({
      id: String(t.externalThesisId || t.id),
      externalThesisId: String(t.externalThesisId || t.id),
      title: t.title,
      author: t.author,
      year: t.year,
      university: t.university,
      strategicRole: t.strategicRole,
      literaturePosition: t.literaturePosition,
      contributionArea: t.contributionArea,
      relevanceReason: t.relevanceReason,
      doi: t.doi,
      thesisType: t.thesisType,
      abstract: t.abstract,
      yokUrl: t.yokUrl,
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

  try {
    invalidateOnboardingStepCache("positioning");
  } catch {
    // Ignore cache tag error if invoked outside Next.js request context
  }

  return savedRecord;
}
