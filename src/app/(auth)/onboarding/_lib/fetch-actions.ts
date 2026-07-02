"use server";

import { eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import {
  thesisMatrices,
  originalityReports,
  thesisBoxes,
} from "@/db/schema";
import type { GeminiThesisBox } from "@/lib/types";
import { getSession } from "@/session";
import { calculateBadge } from "@/lib/academic/badge-calculator";

const boxOrderWeight: Record<string, number> = {
  PROBLEMATIZATION: 1,
  CONCEPTUAL: 2,
  DATA_PROTOCOL: 3,
  PRIMARY_MATERIAL: 4,
  CONTEXT: 5,
  RELATED_THESES: 6,
};

/**
 * Cached DB query that fetches the thesis matrix for a given user.
 * Session extraction (cookies) happens outside — only userId enters the cache key.
 */
async function getCachedThesisMatrix(userId: number) {
  "use cache";
  cacheTag("thesis-matrix");
  cacheLife("minutes");

  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, userId));
  return matrix ?? null;
}

/**
 * Cached DB query that fetches the originality report for a given user.
 */
async function getCachedOriginalityReport(userId: number) {
  "use cache";
  cacheTag("originality-report");
  cacheLife("minutes");

  const [report] = await db
    .select()
    .from(originalityReports)
    .where(eq(originalityReports.userId, userId));
  return report ?? null;
}

/**
 * Cached DB query that fetches boxes for a given thesis matrix.
 */
async function getCachedBoxes(thesisMatrixId: number) {
  "use cache";
  cacheTag("thesis-boxes");
  cacheLife("minutes");

  return db
    .select()
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId))
    .orderBy(
      sql`CASE ${thesisBoxes.boxType}
        WHEN 'PROBLEMATIZATION' THEN 1
        WHEN 'CONCEPTUAL' THEN 2
        WHEN 'DATA_PROTOCOL' THEN 3
        WHEN 'PRIMARY_MATERIAL' THEN 4
        WHEN 'CONTEXT' THEN 5
        WHEN 'RELATED_THESES' THEN 6
        ELSE 99
      END`,
    );
}

/**
 * Server Action: extracts session, then delegates to the cached thesis matrix query.
 *
 * @returns The user's thesis matrix row or null
 */
export async function fetchThesisMatrix() {
  const session = await getSession();
  if (!session) return null;
  return getCachedThesisMatrix(session.userId);
}

/**
 * Server Action: extracts session, then delegates to the cached originality report query.
 *
 * @returns The user's originality report row or null
 */
export async function fetchOriginalityReport() {
  const session = await getSession();
  if (!session) return null;
  return getCachedOriginalityReport(session.userId);
}

/**
 * Server Action: fetches the user's thesis matrix first, then loads the associated boxes.
 *
 * @returns An array of thesis box rows (empty if no matrix exists)
 */
export async function fetchBoxes() {
  const session = await getSession();
  if (!session) return [];
  const matrix = await getCachedThesisMatrix(session.userId);
  if (!matrix) return [];
  return getCachedBoxes(matrix.id);
}

/**
 * Server Action: fetches boxes and maps every row to the full GeminiThesisBox
 * shape clients expect.  The DB is the single source of truth — Zustand boxes
 * are never consulted.
 *
 * @returns GeminiThesisBox[] hydrated from the database (empty if no matrix)
 */
export async function fetchBoxesWithFullShape(): Promise<GeminiThesisBox[]> {
  const session = await getSession();
  if (!session) return [];
  const matrix = await getCachedThesisMatrix(session.userId);
  if (!matrix) return [];
  const rows = await getCachedBoxes(matrix.id);

  // Load related theses from the originality report for RELATED_THESES boxes.
  const report = await getCachedOriginalityReport(session.userId);
  const overlapTable = report?.tezaraResults?.overlapTable ?? [];

  // Group flat rows into parent → sub-boxes tree.
  const parentRows = rows.filter((r) => r.parentId === null);
  const subBoxMap = new Map<number, GeminiThesisBox[]>();
  for (const r of rows) {
    if (r.parentId !== null) {
      const list = subBoxMap.get(r.parentId) ?? [];
      list.push({
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

  const boxes: GeminiThesisBox[] = parentRows.map((b) => {
    const box: GeminiThesisBox = {
      title: b.title,
      boxType: (b.boxType as GeminiThesisBox["boxType"]) ?? "PROBLEMATIZATION",
      description: b.description ?? "",
      parentId: null,
      semanticQuery: null,
      subBoxes: subBoxMap.get(b.id),
      foundationalQueries: b.foundationalQueries ?? [],
      concepts: b.concepts ?? [],
    };

    if (b.boxType === "RELATED_THESES" && overlapTable.length > 0) {
      box.relatedTheses = overlapTable.map((t) => {
        const isIkiz = calculateBadge(t.axes) === "İKİZ TEZ";
        const note = t.comparisonNote || "";
        return {
          title: t.title,
          author: t.author,
          university: t.university,
          year: t.year,
          thesisType: t.thesisType,
          department: t.department,
          axes: t.axes,
          comparisonNote: isIkiz ? `[MUTLAK İKİZ TEHDİDİ] ${note}` : note,
          yokPdfUrl: t.yokPdfUrl,
        };
      });
    }

    return box;
  });

  return boxes.sort((a, b) => {
    const weightA = boxOrderWeight[a.boxType] ?? 99;
    const weightB = boxOrderWeight[b.boxType] ?? 99;
    return weightA - weightB;
  });
}

/**
 * Server Action: checks which onboarding steps have existing data in the database
 * for the current user. Used by the stepper to determine which future steps are
 * clickable (steps with data can be re-visited even if they appear in the future).
 *
 * @returns A record of step key → boolean, or null if no session
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

  const [report] = await db
    .select({ id: originalityReports.id })
    .from(originalityReports)
    .where(eq(originalityReports.userId, userId));

  const hasReport = !!report;

  let hasBoxes = false;

  if (hasMatrix) {
    const [box] = await db
      .select({ id: thesisBoxes.id })
      .from(thesisBoxes)
      .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
      .limit(1);

    hasBoxes = !!box;
  }

  return {
    matrix: hasMatrix,
    risk: hasReport,
    boxes: hasBoxes,
    "literature-review": hasBoxes,
  };
}
