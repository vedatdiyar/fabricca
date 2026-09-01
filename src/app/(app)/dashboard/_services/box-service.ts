import { eq, asc, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import { matrices, boxes, sources } from "@/core/db/schema";
import { compareBoxTypes } from "@/lib/box-constants";

export interface UserBoxData {
  matrix: typeof matrices.$inferSelect;
  parentBoxes: (typeof boxes.$inferSelect)[];
  childIdToParentId: Map<number, number>;
  allBoxRows: (typeof boxes.$inferSelect)[];
}

export interface UserBoxDataWithResources extends UserBoxData {
  resources: (typeof sources.$inferSelect)[];
}

/**
 * Fetches the thesis matrix and box hierarchy for a given user, constructing
 * a child-to-parent ID map for sub-box → master box remapping.
 *
 * @param userId - The authenticated user's ID
 * @returns The matrix, parent boxes, child-parent map, and all box rows
 */
export async function getUsersMatrixAndBoxes(
  userId: number,
): Promise<{ data: UserBoxData } | { error: string }> {
  // Exclude heavy jsonb (auditResult, advisorMessages, rawProposal) — not needed for box hierarchy
  const [matrixRow] = await db
    .select({
      id: matrices.id,
      userId: matrices.userId,
      thesisDegree: matrices.thesisDegree,
      targetCompletionDate: matrices.targetCompletionDate,
      weeklyTargetHours: matrices.weeklyTargetHours,
      subjectProblem: matrices.subjectProblem,
      theoreticalFramework: matrices.theoreticalFramework,
      primaryMaterial: matrices.primaryMaterial,
      methodology: matrices.methodology,
      createdAt: matrices.createdAt,
      updatedAt: matrices.updatedAt,
    })
    .from(matrices)
    .where(eq(matrices.userId, userId));
  const matrix = matrixRow as unknown as
    typeof matrices.$inferSelect | undefined;

  if (!matrix) {
    return { error: "Thesis matrix not found." };
  }

  const allBoxRows = await db
    .select()
    .from(boxes)
    .where(eq(boxes.matrixId, matrix.id))
    .orderBy(asc(boxes.id));

  const parentBoxes = allBoxRows
    .filter((b) => b.parentId === null)
    .sort((a, b) => compareBoxTypes(a.boxType, b.boxType));

  const childIdToParentId = new Map<number, number>();
  for (const row of allBoxRows) {
    if (row.parentId !== null) {
      childIdToParentId.set(row.id, row.parentId);
    }
  }

  return {
    data: {
      matrix,
      parentBoxes,
      childIdToParentId,
      allBoxRows,
    },
  };
}

/**
 * Fetches the thesis matrix, box hierarchy, and all associated library
 * resources for a given user, with resources stored directly on their
 * parent boxId so no remapping is needed.
 *
 * @param userId - The authenticated user's ID
 * @returns Extended data including resources with original boxId
 */
export async function getUsersMatrixAndBoxesWithResources(
  userId: number,
): Promise<{ data: UserBoxDataWithResources } | { error: string }> {
  const boxResult = await getUsersMatrixAndBoxes(userId);

  if ("error" in boxResult) {
    return { error: boxResult.error };
  }

  const { allBoxRows } = boxResult.data;

  let resources: (typeof sources.$inferSelect)[] = [];

  if (allBoxRows.length > 0) {
    const allBoxIds = allBoxRows.map((b) => b.id);

    // Exclude heavy parsedReferences (10-100KB per row) — only fields needed for dashboard listing
    const projected = await db
      .select({
        id: sources.id,
        boxId: sources.boxId,
        title: sources.title,
        authors: sources.authors,
        publisher: sources.publisher,
        isRead: sources.isRead,
        pdfStatus: sources.pdfStatus,
        publicationYear: sources.publicationYear,
        doi: sources.doi,
        createdAt: sources.createdAt,
        updatedAt: sources.updatedAt,
      })
      .from(sources)
      .where(inArray(sources.boxId, allBoxIds));
    // Cast to full Source type — excluded heavy columns (parsedReferences, containerTitle etc.) are not used in dashboard
    resources = projected as unknown as (typeof sources.$inferSelect)[];
  }

  return {
    data: {
      ...boxResult.data,
      resources,
    },
  };
}
