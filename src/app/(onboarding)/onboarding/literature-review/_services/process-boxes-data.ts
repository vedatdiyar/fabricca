import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisMatrices, thesisBoxes } from "@/db/schema";
import { fetchOriginalityReport } from "../../_services/fetch-actions";
import type { JuryArticle } from "@/lib/types";

export interface LoadedMatrixData {
  id: number;
  mainActors: string;
  researchFocus: string;
  context: string;
  theoreticalFramework: string;
  methodology: string;
  mainClaim: string;
}

export interface BoxRowData {
  id: number;
  title: string;
  parentId: number | null;
  description: string | null;
  boxType: string | null;
  semanticQuery: string | null;
}

/**
 * Loads the thesis matrix and box records from the database.
 */
export async function loadThesisMatrixAndBoxes(userId: number): Promise<{
  matrix: LoadedMatrixData | null;
  allBoxRows: BoxRowData[];
}> {
  const [matrix] = await db
    .select({
      id: thesisMatrices.id,
      mainActors: thesisMatrices.mainActors,
      researchFocus: thesisMatrices.researchFocus,
      context: thesisMatrices.context,
      theoreticalFramework: thesisMatrices.theoreticalFramework,
      methodology: thesisMatrices.methodology,
      mainClaim: thesisMatrices.mainClaim,
    })
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, userId));

  const allBoxRows = await db
    .select({
      id: thesisBoxes.id,
      title: thesisBoxes.title,
      parentId: thesisBoxes.parentId,
      description: thesisBoxes.description,
      boxType: thesisBoxes.boxType,
      semanticQuery: thesisBoxes.semanticQuery,
    })
    .from(thesisBoxes)
    .where(eq(thesisBoxes.thesisMatrixId, matrix?.id ?? -1));

  return { matrix, allBoxRows };
}

/**
 * Loads overlapping theses from the originality report for the RELATED_THESES box.
 */
export async function loadOverlapTheses(allBoxRows: BoxRowData[]): Promise<{
  thesisArticlesMap: Map<string, JuryArticle[]>;
}> {
  const thesisArticlesMap = new Map<string, JuryArticle[]>();

  const report = await fetchOriginalityReport();
  const overlapTable = report?.tezaraResults?.overlapTable ?? [];

  if (overlapTable.length === 0) return { thesisArticlesMap };

  const relatedThesesBox =
    allBoxRows.find(
      (row) => row.parentId === null && row.boxType === "RELATED_THESES",
    ) ??
    allBoxRows.find(
      (row) =>
        row.parentId === null &&
        typeof row.title === "string" &&
        row.title.includes("İlişkisel"),
    );
  const relatedBoxTitle =
    relatedThesesBox?.title ?? "İlişkisel Tez Çalışmaları";

  const articles: JuryArticle[] = overlapTable.map((thesis) => {
    return {
      title: thesis.title,
      comparisonNote: null,
      badge: thesis.primaryBadge,
      url: thesis.yokPdfUrl ?? "",
      doi: null as string | null,
      publisher: thesis.university ?? "",
      publicationYear: thesis.year,
      authors: [thesis.author],
      isFoundational: false,
      relevanceScore: 99,
    } satisfies JuryArticle;
  });

  thesisArticlesMap.set(relatedBoxTitle, articles);

  return { thesisArticlesMap };
}
