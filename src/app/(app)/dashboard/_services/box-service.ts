import { eq, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { matrices, boxes, sources } from "@/db/schema";
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
  const [matrix] = await db
    .select()
    .from(matrices)
    .where(eq(matrices.userId, userId));

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

    resources = await db
      .select()
      .from(sources)
      .where(inArray(sources.boxId, allBoxIds));
  }

  return {
    data: {
      ...boxResult.data,
      resources,
    },
  };
}
