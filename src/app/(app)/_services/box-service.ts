import { eq, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, thesisBoxes, libraryResources } from "@/db/schema";

export interface UserBoxData {
  matrix: typeof thesisMatrices.$inferSelect;
  parentBoxes: (typeof thesisBoxes.$inferSelect)[];
  childIdToParentId: Map<number, number>;
  allBoxRows: (typeof thesisBoxes.$inferSelect)[];
}

export interface UserBoxDataWithResources extends UserBoxData {
  resources: (typeof libraryResources.$inferSelect)[];
}

/**
 * Fetches the thesis matrix and box hierarchy for a given user.
 * Constructs a child-to-parent ID map for sub-box → master box remapping.
 *
 * @param userId - The authenticated user's ID
 * @returns The matrix, parent boxes, child-parent map, and all box rows
 */
export async function getUsersMatrixAndBoxes(
  userId: number,
): Promise<{ data: UserBoxData } | { error: string }> {
  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, userId));

  if (!matrix) {
    return { error: "Thesis matrix not found." };
  }

  const allBoxRows = await db
    .select()
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
    .orderBy(asc(thesisBoxes.id));

  const parentBoxes = allBoxRows.filter((b) => b.parentId === null);

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
 * resources for a given user. Resources linked to sub-boxes are remapped
 * to their master box via the child-parent ID map.
 *
 * @param userId - The authenticated user's ID
 * @returns Extended data including resources with remapped thesisBoxId
 */
export async function getUsersMatrixAndBoxesWithResources(
  userId: number,
): Promise<{ data: UserBoxDataWithResources } | { error: string }> {
  const boxResult = await getUsersMatrixAndBoxes(userId);

  if ("error" in boxResult) {
    return { error: boxResult.error };
  }

  const { allBoxRows, childIdToParentId } = boxResult.data;

  let resources: (typeof libraryResources.$inferSelect)[] = [];

  if (allBoxRows.length > 0) {
    const allBoxIds = allBoxRows.map((b) => b.id);

    const rawResources = await db
      .select()
      .from(libraryResources)
      .where(inArray(libraryResources.thesisBoxId, allBoxIds));

    resources = rawResources.map((r) => ({
      ...r,
      thesisBoxId: childIdToParentId.get(r.thesisBoxId) ?? r.thesisBoxId,
    }));
  }

  return {
    data: {
      ...boxResult.data,
      resources,
    },
  };
}
