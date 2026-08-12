"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { matrices, positioning, boxes, sources, outlines } from "@/db/schema";
import type { GeminiThesisBox } from "@/lib/types";
import { getSession } from "@/lib/session";
import { BOX_ORDER_WEIGHT } from "@/lib/box-constants";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { DatabaseError } from "@/lib/errors/app-error";

/**
 * Rethrows an already-normalized DatabaseError unchanged, or wraps any other
 * thrown value into a DatabaseError so downstream callers stop the flow.
 *
 * @param err - The thrown value to normalize.
 * @param message - Internal technical message for the wrapped error.
 * @param technicalDetails - Optional diagnostic context for the wrapped error.
 */
function rethrowAsDatabaseError(
  err: unknown,
  message: string,
  technicalDetails?: Record<string, unknown>,
): never {
  if (err instanceof DatabaseError) throw err;
  throw new DatabaseError({
    cause: err,
    message,
    technicalDetails: technicalDetails ?? {
      cause:
        err instanceof Error ? err.message : err === undefined ? "undefined" : String(err),
    },
  });
}

/**
 * Cached DB query returning the user's thesis matrix (userId-keyed).
 *
 * @param userId - The id of the user to load the matrix for.
 * @returns The user's thesis matrix or null.
 */
async function getCachedThesisMatrix(userId: number) {
  "use cache";
  cacheTag(CACHE_TAGS.thesisMatrix);
  cacheLife("minutes");

  try {
    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, userId));
    return matrix ?? null;
  } catch (err) {
    rethrowAsDatabaseError(err, "Failed to load cached thesis matrix.", {
      userId,
    });
  }
}

/**
 * Cached DB query fetching boxes for a given thesis matrix.
 *
 * @param thesisMatrixId - The id of the thesis matrix to load boxes for.
 * @returns The ordered box rows for the thesis matrix.
 */
async function getCachedBoxes(thesisMatrixId: number) {
  "use cache";
  cacheTag(CACHE_TAGS.thesisBoxes);
  cacheLife("minutes");

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
 * Returns the current user's thesis matrix or null.
 *
 * @returns The current user's thesis matrix or null.
 */
export async function fetchThesisMatrix() {
  try {
    const session = await getSession();
    if (!session) return null;
    return getCachedThesisMatrix(session.userId);
  } catch (err) {
    rethrowAsDatabaseError(err, "Failed to fetch thesis matrix.");
  }
}

/**
 * Fetches the thesis matrix directly from the DB, bypassing the cache.
 *
 * @returns The current user's thesis matrix or null.
 */
export async function fetchThesisMatrixFresh() {
  try {
    const session = await getSession();
    if (!session) return null;

    const [matrix] = await db
      .select()
      .from(matrices)
      .where(eq(matrices.userId, session.userId));
    return matrix ?? null;
  } catch (err) {
    rethrowAsDatabaseError(err, "Failed to fetch fresh thesis matrix.");
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

    return mappedBoxes.sort((a, b) => {
      const weightA = BOX_ORDER_WEIGHT[a.boxType] ?? 99;
      const weightB = BOX_ORDER_WEIGHT[b.boxType] ?? 99;
      return weightA - weightB;
    });
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
          ELSE 99
        END`,
      );

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

    return mappedBoxes.sort((a, b) => {
      const weightA = BOX_ORDER_WEIGHT[a.boxType] ?? 99;
      const weightB = BOX_ORDER_WEIGHT[b.boxType] ?? 99;
      return weightA - weightB;
    });
  } catch (err) {
    rethrowAsDatabaseError(err, "Failed to fetch uncached boxes.");
  }
}

/**
 * Returns which onboarding steps have data for the current user.
 *
 * @returns A record mapping step keys to data presence, or null.
 */
export async function checkStepsDataAction(): Promise<Record<
  string,
  boolean
> | null> {
  try {
    const session = await getSession();
    if (!session) return null;

    const userId = session.userId;

    const [matrix] = await db
      .select({ id: matrices.id })
      .from(matrices)
      .where(eq(matrices.userId, userId));

    const hasMatrix = !!matrix;

    let hasPositioning = false;
    let hasBoxes = false;
    let hasOutline = false;
    let hasLiterature = false;

    if (hasMatrix) {
      const [posResult, boxResult, outlineResult, litResult] = await Promise.all([
        db
          .select({
            id: positioning.id,
            globalStatus: positioning.globalStatus,
          })
          .from(positioning)
          .where(eq(positioning.userId, userId))
          .limit(1),
        db
          .select({ id: boxes.id })
          .from(boxes)
          .where(eq(boxes.matrixId, matrix.id))
          .limit(1),
        db
          .select({ id: outlines.id })
          .from(outlines)
          .where(eq(outlines.matrixId, matrix.id))
          .limit(1),
        db
          .select({ id: sources.id })
          .from(sources)
          .innerJoin(boxes, eq(sources.boxId, boxes.id))
          .where(
            and(
              eq(boxes.matrixId, matrix.id),
              ne(boxes.boxType, "RELATED_THESES"),
            ),
          )
          .limit(1),
      ]);

      hasPositioning = posResult.length > 0 && !!posResult[0].globalStatus;
      hasBoxes = boxResult.length > 0;
      hasOutline = outlineResult.length > 0;
      hasLiterature = litResult.length > 0;
    }

    return {
      matrix: hasMatrix,
      positioning: hasPositioning,
      boxes: hasBoxes,
      outline: hasOutline,
      "literature-review": hasLiterature,
    };
  } catch (err) {
    rethrowAsDatabaseError(err, "Failed to check onboarding step data.");
  }
}
