"use server";

import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import {
  thesisMatrices,
  originalityReports,
  thesisBoxes,
  libraryResources,
} from "@/db/schema";
import { getSession } from "@/session";

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
    .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));
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
  let hasLiterature = false;

  if (hasMatrix) {
    const [box] = await db
      .select({ id: thesisBoxes.id })
      .from(thesisBoxes)
      .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
      .limit(1);

    hasBoxes = !!box;

    if (hasBoxes) {
      const [resource] = await db
        .select({ id: libraryResources.id })
        .from(libraryResources)
        .innerJoin(
          thesisBoxes,
          eq(libraryResources.thesisBoxId, thesisBoxes.id),
        )
        .where(eq(thesisBoxes.thesisMatrixId, matrix.id))
        .limit(1);

      hasLiterature = !!resource;
    }
  }

  return {
    matrix: hasMatrix,
    enrichment: hasMatrix,
    risk: hasReport,
    boxes: hasBoxes,
    "literature-review": hasLiterature,
  };
}
