import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { boxes, sources } from "@/core/db/schema";
import type { LiteraturePoolEntry, JuryArticle } from "@/lib/types";

/**
 * Loads previously saved library resources in pool format.
 *
 * @param thesisMatrixId - The thesis matrix ID to load resources for.
 * @returns The literature pool entries grouped by thesis box.
 */
export async function fetchPreloadedPool(
  thesisMatrixId: number,
): Promise<LiteraturePoolEntry[]> {
  const rows = await db
    .select({
      thesisBoxId: sources.boxId,
      boxTitle: boxes.title,
      boxType: boxes.boxType,
      title: sources.title,
      openalexId: sources.openalexId,
      doi: sources.doi,
      publisher: sources.publisher,
      publicationYear: sources.publicationYear,
      authors: sources.authors,
    })
    .from(sources)
    .innerJoin(boxes, eq(sources.boxId, boxes.id))
    .where(eq(boxes.matrixId, thesisMatrixId));

  const grouped = new Map<
    number,
    { boxTitle: string; boxType: string | null; articles: JuryArticle[] }
  >();
  for (const row of rows) {
    const existing = grouped.get(row.thesisBoxId);
    const list = existing?.articles ?? [];
    list.push({
      title: row.title,
      comparisonNote: null,
      openalexId: row.openalexId ?? null,
      doi: row.doi,
      publisher: row.publisher ?? "",
      thesisType: null,
      publicationYear: row.publicationYear ?? 0,
      authors: (row.authors as string[]) ?? [],
      relevanceScore: 0,
    });
    grouped.set(row.thesisBoxId, {
      boxTitle: row.boxTitle,
      boxType: row.boxType,
      articles: list,
    });
  }

  for (const [, group] of grouped) {
    group.articles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    if (group.boxType !== "RELATED_THESES" && group.articles.length > 4) {
      group.articles.length = 4;
    }
  }

  const pool: LiteraturePoolEntry[] = [];
  for (const [thesisBoxId, group] of grouped) {
    pool.push({
      subBoxTitle: group.boxTitle,
      thesisBoxId,
      articles: group.articles,
    });
  }

  return pool;
}
