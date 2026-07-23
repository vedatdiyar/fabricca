import { sql } from "drizzle-orm";
import { db } from "@/db";
import { thesisPositioning } from "@/db/schema";
import type { Logger } from "@/lib/logger";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";
import type {
  PositioningMatrixInput,
  RecommendedThesisItem,
} from "../_lib/validation";
import type { JuryAnalysisResult } from "./analysis";

/**
 * Persists the positioning report (input matrix, LLM jury analysis result, and recommended guide theses)
 * to the `thesis_positioning` database table within a transaction and invalidates step cache.
 *
 * @param userId - ID of the authenticated user.
 * @param input - The validated 5-field positioning matrix input.
 * @param analysisResult - The LLM Jury analysis result.
 * @param logger - Optional Logger instance for telemetry.
 * @returns Promise resolving to the saved thesisPositioning record.
 */
export async function savePositioningReportTransaction(
  userId: number,
  input: PositioningMatrixInput,
  analysisResult: JuryAnalysisResult,
  logger?: Logger,
) {
  const startTime = performance.now();

  logger?.info("positioning_db_transaction_start", {
    service: "db",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/decision-engine.ts",
    data: { userId, globalStatus: analysisResult.globalStatus },
  });

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
    }));

  const savedRecord = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(thesisPositioning)
      .values({
        userId,
        matrixInput: input,
        globalStatus: analysisResult.globalStatus,
        gapAnalysisSummary: analysisResult.gapAnalysisSummary,
        recommendedTheses: formattedRecommendedTheses,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: thesisPositioning.userId,
        set: {
          matrixInput: input,
          globalStatus: analysisResult.globalStatus,
          gapAnalysisSummary: analysisResult.gapAnalysisSummary,
          recommendedTheses: formattedRecommendedTheses,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    return row;
  });

  // Invalidate Next.js cache for positioning step and downstream paths
  invalidateOnboardingStepCache("positioning");

  logger?.info("positioning_db_transaction_success", {
    service: "db",
    filePath:
      "src/app/(onboarding)/onboarding/positioning/_services/decision-engine.ts",
    durationMs: performance.now() - startTime,
    data: { recordId: savedRecord.id, userId },
  });

  return savedRecord;
}
