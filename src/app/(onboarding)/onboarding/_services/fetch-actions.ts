"use server";

import { eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import {
  thesisMatrices,
  thesisPositioning,
  thesisBoxes,
  libraryResources,
} from "@/db/schema";
import type { GeminiThesisBox } from "@/lib/types";
import { getSession } from "@/lib/session";
import { BOX_ORDER_WEIGHT } from "../_lib/box-constants";

/**
 * Cached DB query that returns the user's thesis matrix.
 * Session (cookies) is extracted beforehand — only userId enters the cache key.
 */
async function getCachedThesisMatrix(userId: number) {
  try {
    cacheTag("thesis-matrix");
    cacheLife("minutes");
  } catch {
    // Fallback when executed outside Next.js request context (e.g., CLI / tests)
  }

  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, userId));
  return matrix ?? null;
}

/**
 * Cached DB query that fetches boxes for a given thesis matrix.
 */
async function getCachedBoxes(thesisMatrixId: number) {
  try {
    cacheTag("thesis-boxes");
    cacheLife("minutes");
  } catch {
    // Fallback when executed outside Next.js request context (e.g., CLI / tests)
  }

  return db
    .select()
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId))
    .orderBy(
      sql`CASE ${thesisBoxes.boxType}
        WHEN 'PROBLEMATIZATION' THEN 1
        WHEN 'CONCEPTUAL' THEN 2
        WHEN 'CONTEXT' THEN 3
        WHEN 'DATA_PROTOCOL' THEN 4
        WHEN 'PRIMARY_MATERIAL' THEN 5
        WHEN 'RELATED_THESES' THEN 6
        ELSE 99
      END`,
    );
}

/**
 * Server Action: extracts the session, then delegates to the cached thesis
 * matrix query.
 *
 * @returns The user's thesis matrix row or null
 */
export async function fetchThesisMatrix() {
  const session = await getSession();
  if (!session) return null;
  return getCachedThesisMatrix(session.userId);
}

/**
 * Server Action: fetches the thesis matrix directly from the DB, bypassing
 * the Next.js cache. Used after onboarding reset to prevent stale cache data.
 *
 * @returns The user's thesis matrix row or null
 */
export async function fetchThesisMatrixFresh() {
  const session = await getSession();
  if (!session) return null;

  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, session.userId));
  return matrix ?? null;
}

/**
 * Server Action: fetches boxes and maps each row to the full GeminiThesisBox
 * structure expected by client components. The DB is used as the single source
 * of truth.
 *
 * @returns GeminiThesisBox[] from the DB (empty array if no matrix)
 */
export async function fetchBoxesWithFullShape(): Promise<GeminiThesisBox[]> {
  const session = await getSession();
  if (!session) return [];
  const matrix = await getCachedThesisMatrix(session.userId);
  if (!matrix) return [];
  const rows = await getCachedBoxes(matrix.id);

  // Group flat rows into a parent → child tree
  const parentRows = rows.filter((r) => r.parentId === null);
  const subBoxMap = new Map<number, GeminiThesisBox[]>();
  for (const r of rows) {
    if (r.parentId !== null) {
      const list = subBoxMap.get(r.parentId) ?? [];
      list.push({
        id: r.id,
        title: r.title,
        boxType:
          (r.boxType as GeminiThesisBox["boxType"]) ?? "PROBLEMATIZATION",
        description: r.description ?? "",
        parentId: r.parentId,
        semanticQuery: r.semanticQuery,
        subBoxes: undefined,
        foundationalQueries: r.foundationalQueries ?? [],
        concepts: r.concepts ?? [],
      });
      subBoxMap.set(r.parentId, list);
    }
  }

  const boxes: GeminiThesisBox[] = parentRows.map((b) => ({
    id: b.id,
    title: b.title,
    boxType: (b.boxType as GeminiThesisBox["boxType"]) ?? "PROBLEMATIZATION",
    description: b.description ?? "",
    parentId: null,
    semanticQuery: null,
    subBoxes: subBoxMap.get(b.id),
    foundationalQueries: b.foundationalQueries ?? [],
    concepts: b.concepts ?? [],
  }));

  return boxes.sort((a, b) => {
    const weightA = BOX_ORDER_WEIGHT[a.boxType] ?? 99;
    const weightB = BOX_ORDER_WEIGHT[b.boxType] ?? 99;
    return weightA - weightB;
  });
}

/**
 * Server Action: checks which onboarding steps have data in the database
 * for the current user.
 *
 * @returns A step-key → boolean record or null
 */
export async function checkStepsDataAction(): Promise<Record<
  string,
  boolean
> | null> {
  const session = await getSession();
  if (!session) return null;

  const userId = session.userId;

  const [matrix] = await db
    .select({ id: thesisMatrices.id })
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, userId));

  const hasMatrix = !!matrix;

  let hasPositioning = false;
  let hasBoxes = false;
  let hasLiterature = false;

  if (hasMatrix) {
    const [posResult, boxResult, litResult] = await Promise.all([
      db
        .select({
          id: thesisPositioning.id,
          globalStatus: thesisPositioning.globalStatus,
        })
        .from(thesisPositioning)
        .where(eq(thesisPositioning.userId, userId))
        .limit(1),
      db
        .select({ id: thesisBoxes.id })
        .from(thesisBoxes)
        .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
        .limit(1),
      db
        .select({ id: libraryResources.id })
        .from(libraryResources)
        .innerJoin(
          thesisBoxes,
          eq(libraryResources.thesisBoxId, thesisBoxes.id),
        )
        .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
        .limit(1),
    ]);

    hasPositioning = posResult.length > 0 && !!posResult[0].globalStatus;
    hasBoxes = boxResult.length > 0;
    hasLiterature = litResult.length > 0;
  }

  return {
    matrix: hasMatrix,
    positioning: hasPositioning,
    boxes: hasBoxes,
    "literature-review": hasLiterature,
  };
}
