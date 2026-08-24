import { eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/core/db";
import { boxes } from "@/core/db/schema";
import type { GeminiThesisBox } from "@/lib/types";
import { getSession } from "@/lib/session";
import { sortByBoxType } from "@/lib/box-constants";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { rethrowAsDatabaseError } from "@/lib/errors/db-error";
import { getCachedThesisMatrix, fetchThesisMatrixFresh } from "./matrix-fetch";

/**
 * Maps raw box rows to the production GeminiThesisBox shape.
 *
 * @param rows - Raw box rows from the database.
 * @returns Production-shaped boxes sorted by canonical box type order.
 */
function rowsToGeminiBoxes(
  rows: (typeof boxes.$inferSelect)[],
): GeminiThesisBox[] {
  const parentRows = rows.filter((r) => r.parentId === null);
  const subBoxMap = new Map<number, GeminiThesisBox[]>();
  for (const r of rows) {
    if (r.parentId !== null) {
      const list = subBoxMap.get(r.parentId) ?? [];
      list.push({
        id: r.id,
        title: r.title,
        boxType: (r.boxType as GeminiThesisBox["boxType"]) ?? "SUBJECT_PROBLEM",
        description: r.description ?? "",
        parentId: r.parentId,
        semanticQuery: r.semanticQuery,
        subBoxes: undefined,
        concepts: r.concepts ?? [],
      });
      subBoxMap.set(r.parentId, list);
    }
  }

  const mappedBoxes: GeminiThesisBox[] = parentRows.map((b) => ({
    id: b.id,
    title: b.title,
    boxType: (b.boxType as GeminiThesisBox["boxType"]) ?? "SUBJECT_PROBLEM",
    description: b.description ?? "",
    parentId: null,
    semanticQuery: null,
    subBoxes: subBoxMap.get(b.id),
    concepts: b.concepts ?? [],
  }));

  return mappedBoxes.sort(sortByBoxType);
}

/**
 * Cached DB query fetching boxes for a given thesis matrix.
 *
 * @param thesisMatrixId - The id of the thesis matrix to load boxes for.
 * @returns The ordered box rows for the thesis matrix.
 */
export async function getCachedBoxes(thesisMatrixId: number) {
  "use cache";
  try {
    cacheTag(CACHE_TAGS.thesisBoxes);
    cacheLife("minutes");
  } catch {
    // Graceful fallback when executed outside Next.js request context
  }

  try {
    return db
      .select()
      .from(boxes)
      .where(eq(boxes.matrixId, thesisMatrixId))
      .orderBy(
        sql`CASE ${boxes.boxType}
          WHEN 'SUBJECT_PROBLEM' THEN 1
          WHEN 'THEORETICAL_FRAMEWORK' THEN 2
          WHEN 'METHODOLOGY' THEN 3
          WHEN 'PRIMARY_MATERIAL' THEN 4
          WHEN 'RELATED_THESES' THEN 5
          ELSE 99
        END`,
      );
  } catch (err) {
    rethrowAsDatabaseError(err, "Failed to load cached boxes.", {
      thesisMatrixId,
    });
  }
}

/**
 * Fetches boxes mapped to the full GeminiThesisBox shape expected by clients.
 *
 * @returns The current user's boxes in production shape, or an empty array.
 */
export async function fetchBoxesWithFullShape(): Promise<GeminiThesisBox[]> {
  try {
    const session = await getSession();
    if (!session) return [];
    const matrix = await getCachedThesisMatrix(session.userId);
    if (!matrix) return [];
    const rows = await getCachedBoxes(matrix.id);
    return rowsToGeminiBoxes(rows);
  } catch (err) {
    rethrowAsDatabaseError(err, "Failed to fetch boxes with full shape.");
  }
}

/**
 * Fetches boxes mapped to the full GeminiThesisBox shape directly from the database without caching.
 *
 * @returns The current user's boxes in production shape directly from DB, or an empty array.
 */
export async function fetchUncachedBoxesWithFullShape(): Promise<
  GeminiThesisBox[]
> {
  try {
    const session = await getSession();
    if (!session) return [];
    const matrix = await fetchThesisMatrixFresh();
    if (!matrix) return [];

    const rows = await db
      .select()
      .from(boxes)
      .where(eq(boxes.matrixId, matrix.id))
      .orderBy(
        sql`CASE ${boxes.boxType}
          WHEN 'SUBJECT_PROBLEM' THEN 1
          WHEN 'THEORETICAL_FRAMEWORK' THEN 2
          WHEN 'METHODOLOGY' THEN 3
          WHEN 'PRIMARY_MATERIAL' THEN 4
          WHEN 'RELATED_THESES' THEN 5
          ELSE 99
        END`,
      );

    return rowsToGeminiBoxes(rows);
  } catch (err) {
    rethrowAsDatabaseError(err, "Failed to fetch uncached boxes.");
  }
}
