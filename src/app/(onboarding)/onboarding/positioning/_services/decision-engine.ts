import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boxes, matrices, positioning, sources } from "@/db/schema";
import { invalidateOnboardingStepCache } from "@/lib/cache-tags";
import type {
  PositioningMatrixInput,
  RecommendedThesisItem,
} from "../_lib/validation";
import type { JuryAnalysisResult } from "./analysis";

/** Display title of the parent box holding strategic guide theses. */
const RELATED_THESES_TITLE = "İlgili Tezler";

/** Transaction client type bound to the database pool. */
type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Synchronizes the strategic guide theses into the sources table under a single
 * dedicated parent box, deleting prior entries before inserting the current set.
 *
 * @param tx - The active database transaction client.
 * @param userId - The id of the user owning the theses.
 * @param theses - The recommended theses to persist as sources.
 */
async function syncRelatedTheses(
  tx: TxClient,
  userId: number,
  theses: JuryAnalysisResult["recommendedTheses"],
): Promise<void> {
  if (theses.length === 0) {
    return;
  }

  const [matrix] = await tx
    .select({ id: matrices.id })
    .from(matrices)
    .where(eq(matrices.userId, userId))
    .limit(1);

  if (!matrix) {
    return;
  }

  let [relatedBox] = await tx
    .select({ id: boxes.id })
    .from(boxes)
    .where(
      and(eq(boxes.matrixId, matrix.id), eq(boxes.boxType, "RELATED_THESES")),
    )
    .limit(1);

  if (!relatedBox) {
    const [inserted] = await tx
      .insert(boxes)
      .values({
        matrixId: matrix.id,
        parentId: null,
        boxType: "RELATED_THESES",
        title: RELATED_THESES_TITLE,
        description: null,
        semanticQuery: null,
        concepts: [],
        foundationalQueries: [],
      })
      .returning({ id: boxes.id });
    relatedBox = inserted;
  }

  if (!relatedBox) {
    return;
  }

  await tx.delete(sources).where(eq(sources.boxId, relatedBox.id));

  const toInsert = theses.map((t) => ({
    boxId: relatedBox.id,
    title: t.title,
    authors: [t.author].filter((a) => a.length > 0),
    publisher: t.university || null,
    publicationYear: t.year,
    doi: t.doi || null,
    comparisonNote:
      [t.contributionArea, t.relevanceReason]
        .filter((s) => s && s.trim().length > 0)
        .join("\n") || null,
    isRead: true,
    isFoundational: false,
  }));

  if (toInsert.length > 0) {
    await tx.insert(sources).values(toInsert);
  }
}

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
  input: PositioningMatrixInput,
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
    }));

  const savedRecord = await db.transaction(async (tx) => {
    await syncRelatedTheses(tx, userId, analysisResult.recommendedTheses);

    const [row] = await tx
      .insert(positioning)
      .values({
        userId,
        matrixInput: input,
        globalStatus: analysisResult.globalStatus,
        gapAnalysisSummary: analysisResult.gapAnalysisSummary,
        recommendedTheses: formattedRecommendedTheses,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: positioning.userId,
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

  invalidateOnboardingStepCache("positioning");

  return savedRecord;
}
