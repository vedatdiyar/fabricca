"use server";

import { eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import {
  thesisMatrices,
  originalityReports,
  thesisBoxes,
  libraryResources,
} from "@/db/schema";
import type {
  GeminiThesisBox,
  OriginalityReportData,
  RelationshipBadge,
  AcademicBadge,
} from "@/lib/types";
import { getSession } from "@/lib/session";
import { BOX_ORDER_WEIGHT } from "../_lib/box-constants";

/**
 * Reconstructs a nested TezaraResults contract from flat multi-row DB output.
 * Uses the deterministic badge system (primaryBadge / badges).
 *
 * @param rows - Flat DB rows for a single userId
 * @returns The reconstructed OriginalityReportData or null
 */
function groupRowsToReport(
  rows: Array<{
    externalThesisId: number;
    title: string;
    author: string;
    university: string;
    year: number;
    thesisType: string;
    department: string;
    yokPdfUrl: string | null;
    abstract: string | null;
    isRelevant: boolean;
    relevanceExplanation: string | null;
    originalityStatus: string;
    uniquenessGap: string | null;
    replicationWarning: string | null;
    literatureReviewUsage: string | null;
    chapterIntegration: string | null;
    conceptualBorrowing: string | null;
    isEliminated: boolean;
    eliminationStage: string | null;
  }>,
): OriginalityReportData | null {
  if (rows.length === 0) return null;

  const activeRows = rows.filter((r) => !r.isEliminated);
  const eliminatedRows = rows.filter(
    (r) => r.isEliminated && r.eliminationStage === "ANALYSIS",
  );

  // Global badge: determined by the presence of RISK bucket theses
  let globalBadge: RelationshipBadge = "UNRELATED";

  const hasDuplicate = activeRows.some(
    (r) => r.originalityStatus === "HIGH_RISK_REPLICATION",
  );
  const hasContribution = activeRows.length > 0 && !hasDuplicate;

  if (hasDuplicate) {
    globalBadge = "HIGH_RISK";
  } else if (hasContribution) {
    globalBadge = "CONTRIBUTION_READY";
  }

  const buildEntry = (row: (typeof rows)[number]) => ({
    id: row.externalThesisId,
    title: row.title,
    author: row.author,
    university: row.university,
    year: row.year,
    thesisType: row.thesisType,
    department: row.department,
    yokPdfUrl: row.yokPdfUrl ?? undefined,
    abstract: row.abstract ?? undefined,
    isRelevant: row.isRelevant,
    relevanceExplanation: row.relevanceExplanation ?? "",
    originalityStatus: row.originalityStatus as AcademicBadge,
    uniquenessGap: row.uniquenessGap ?? "",
    replicationWarning: row.replicationWarning ?? "",
    literatureReviewUsage: row.literatureReviewUsage ?? "",
    chapterIntegration: row.chapterIntegration ?? "",
    conceptualBorrowing: row.conceptualBorrowing ?? "",
  });

  return {
    tezaraResults: {
      relationshipBadge: globalBadge,
      overlapTable: activeRows.map((row) => ({
        ...buildEntry(row),
      })),
      eliminatedTheses: eliminatedRows.map((row) => ({
        ...buildEntry(row),
        eliminationStage: row.eliminationStage as "ANALYSIS",
      })),
    },
  };
}

/**
 * Cached DB query that returns the user's thesis matrix.
 * Session (cookies) is extracted beforehand — only userId enters the cache key.
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
 * Cached DB query that reconstructs a nested TezaraResults contract from
 * flat multi-row DB output.
 */
async function getCachedOriginalityReport(
  userId: number,
): Promise<OriginalityReportData | null> {
  "use cache";
  cacheTag("originality-report");
  cacheLife("minutes");

  const rows = await db
    .select()
    .from(originalityReports)
    .where(eq(originalityReports.userId, userId));

  return groupRowsToReport(rows);
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
 * Server Action: extracts the session, then delegates to the cached
 * originality report query.
 *
 * @returns The reconstructed OriginalityReportData or null
 */
export async function fetchOriginalityReport(): Promise<OriginalityReportData | null> {
  const session = await getSession();
  if (!session) return null;
  return getCachedOriginalityReport(session.userId);
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
  const [rows, report] = await Promise.all([
    getCachedBoxes(matrix.id),
    getCachedOriginalityReport(session.userId),
  ]);
  const overlapTable = report?.tezaraResults?.overlapTable ?? [];

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

  const boxes: GeminiThesisBox[] = parentRows.map((b) => {
    const box: GeminiThesisBox = {
      id: b.id,
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
      box.relatedTheses = overlapTable.map((t) => ({
        title: t.title,
        author: t.author,
        university: t.university,
        year: t.year,
        thesisType: t.thesisType,
        department: t.department,
        originalityStatus: t.originalityStatus,
        yokPdfUrl: t.yokPdfUrl,
      }));
    }

    return box;
  });

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

  const [matrixResult, reportResult] = await Promise.all([
    db
      .select({ id: thesisMatrices.id })
      .from(thesisMatrices)
      .where(eq(thesisMatrices.userId, userId)),
    db
      .select({ id: originalityReports.id })
      .from(originalityReports)
      .where(eq(originalityReports.userId, userId)),
  ]);

  const matrix = matrixResult[0];
  const report = reportResult[0];
  const hasMatrix = !!matrix;
  const hasReport = !!report;

  let hasBoxes = false;
  let hasLiterature = false;

  if (hasMatrix) {
    const [boxResult, litResult] = await Promise.all([
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

    hasBoxes = boxResult.length > 0;
    hasLiterature = litResult.length > 0;
  }

  return {
    matrix: hasMatrix,
    risk: hasReport,
    boxes: hasBoxes,
    "literature-review": hasLiterature,
  };
}
