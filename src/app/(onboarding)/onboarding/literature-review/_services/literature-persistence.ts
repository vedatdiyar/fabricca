import { eq } from "drizzle-orm";
import { db } from "@/db";
import { boxes, sources } from "@/db/schema";
import { normalizeTitle } from "@/lib/academic/utils";
import type { LiteraturePoolEntry, JuryArticle } from "@/lib/types";
import type { NewSource } from "@/db/schema";

export type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Loads existing records for a single box, deduplicates new articles
 * by title/DOI, and returns the list of records ready to insert.
 *
 * @param tx - Transaction client
 * @param thesisBoxId - The target box's DB id
 * @param articles - Articles to filter and prepare
 * @returns Prepared insert records and skip count
 */
async function insertLiteratureBatch(
  tx: TxClient,
  thesisBoxId: number,
  articles: JuryArticle[],
): Promise<{ toInsert: NewSource[]; skipped: number }> {
  const existingRecords = await tx
    .select({ title: sources.title, doi: sources.doi })
    .from(sources)
    .where(eq(sources.boxId, thesisBoxId));

  const existingTitleSet = new Set(
    existingRecords.map((r) => normalizeTitle(r.title)).filter(Boolean),
  );
  const existingDoiSet = new Set(
    existingRecords
      .map((r) => r.doi?.toLowerCase().trim())
      .filter((d): d is string => !!d),
  );

  const toInsert: NewSource[] = [];
  let skipped = 0;

  for (const article of articles) {
    const titleKey = normalizeTitle(article.title);
    const doiKey = article.doi?.toLowerCase().trim() ?? null;

    if (
      !titleKey ||
      existingTitleSet.has(titleKey) ||
      (doiKey && existingDoiSet.has(doiKey))
    ) {
      skipped++;
      continue;
    }

    existingTitleSet.add(titleKey);
    if (doiKey) existingDoiSet.add(doiKey);

    toInsert.push({
      boxId: thesisBoxId,
      title: article.title,
      abstract: article.abstract ?? article.comparisonNote ?? null,
      comparisonNote: article.comparisonNote ?? null,
      badge: article.badge ?? null,
      url: article.url ?? null,
      doi: article.doi?.trim() || null,
      publisher: article.publisher ?? null,
      publicationYear: article.publicationYear ?? null,
      authors: article.authors.filter(Boolean) as string[],
      isRead: false,
      isFoundational: article.isFoundational ?? false,
      relevanceScore: article.relevanceScore ?? 0,
    });
  }

  return { toInsert, skipped };
}

/**
 * Persists articles directly to the target box using its DB id.
 * No title-based lookup — the thesisBoxId is passed directly and safely.
 *
 * @param thesisBoxId - The target sub-box's database ID
 * @param articles - Articles to persist
 */
export async function persistSubBoxEntry(
  thesisBoxId: number,
  articles: JuryArticle[],
): Promise<void> {
  await db.transaction(async (tx) => {
    const limit = 4;
    const sorted = [...articles].sort((a, b) => {
      if (a.isFoundational && !b.isFoundational) return -1;
      if (!a.isFoundational && b.isFoundational) return 1;
      return b.relevanceScore - a.relevanceScore;
    });
    const sliced = limit !== undefined ? sorted.slice(0, limit) : sorted;

    const { toInsert } = await insertLiteratureBatch(tx, thesisBoxId, sliced);

    if (toInsert.length > 0) {
      await tx.insert(sources).values(toInsert);
    }
  });
}

/**
 * Confirms the entire literature pool by persisting all entries in a single
 * transaction. Uses thesisBoxId directly from each pool entry — no title lookup.
 *
 * @param literaturePool - Pool entries with thesisBoxId
 */
export async function persistLiteraturePool(
  literaturePool: LiteraturePoolEntry[],
): Promise<void> {
  const allTopArticles: { entry: LiteraturePoolEntry; article: JuryArticle }[] =
    [];
  for (const entry of literaturePool) {
    const sorted = [...entry.articles].sort(
      (a, b) => b.relevanceScore - a.relevanceScore,
    );
    const sliced = sorted.slice(0, 4);
    for (const article of sliced) {
      allTopArticles.push({ entry, article });
    }
  }

  const entryArticleMap = new Map<number, JuryArticle[]>();
  for (const { entry, article } of allTopArticles) {
    const list = entryArticleMap.get(entry.thesisBoxId) ?? [];
    list.push(article);
    entryArticleMap.set(entry.thesisBoxId, list);
  }

  await db.transaction(async (tx) => {
    await Promise.all(
      literaturePool.map(async (entry) => {
        const articles = entryArticleMap.get(entry.thesisBoxId) ?? [];

        const { toInsert } = await insertLiteratureBatch(
          tx,
          entry.thesisBoxId,
          articles,
        );

        if (toInsert.length > 0) {
          await tx.insert(sources).values(toInsert);
        }
      }),
    );
  });
}

/**
 * Persists archive entries using thesisBoxId directly — no title lookup.
 */
export async function persistArchiveEntries(
  entries: { thesisBoxId: number; articles: JuryArticle[] }[],
  onWarn?: (message: string, data?: Record<string, unknown>) => void,
): Promise<void> {
  await db.transaction(async (tx) => {
    const skippedResults = await Promise.all(
      entries.map(async (entry) => {
        const { toInsert, skipped } = await insertLiteratureBatch(
          tx,
          entry.thesisBoxId,
          entry.articles,
        );

        if (toInsert.length > 0) {
          await tx.insert(sources).values(toInsert);
        }

        return skipped;
      }),
    );

    const totalSkipped = skippedResults.reduce(
      (sum, current) => sum + current,
      0,
    );

    if (totalSkipped > 0) {
      onWarn?.("append_archive_duplicate_skipped", { totalSkipped });
    }
  });
}

/**
 * Loads previously saved library resources in pool format.
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
      abstract: sources.abstract,
      comparisonNote: sources.comparisonNote,
      badge: sources.badge,
      url: sources.url,
      doi: sources.doi,
      publisher: sources.publisher,
      publicationYear: sources.publicationYear,
      authors: sources.authors,
      isFoundational: sources.isFoundational,
      relevanceScore: sources.relevanceScore,
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
      comparisonNote: row.comparisonNote ?? null,
      abstract: row.abstract ?? row.comparisonNote ?? null,
      badge: row.badge ?? null,
      url: row.url ?? "",
      doi: row.doi,
      publisher: row.publisher ?? "",
      publicationYear: row.publicationYear ?? 0,
      authors: (row.authors as string[]) ?? [],
      isFoundational: row.isFoundational ?? false,
      relevanceScore: row.relevanceScore ?? 0,
    });
    grouped.set(row.thesisBoxId, {
      boxTitle: row.boxTitle,
      boxType: row.boxType,
      articles: list,
    });
  }

  for (const [, group] of grouped) {
    group.articles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    if (group.articles.length > 4) {
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
