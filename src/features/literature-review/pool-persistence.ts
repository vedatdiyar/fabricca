import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { normalizeTitle } from "@/lib/academic/utils";
import type { LiteraturePoolEntry, JuryArticle } from "@/lib/types";
import type { NewSource } from "@/db/schema";

export type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Loads existing records for a box, deduplicates new articles by title/DOI, and returns the records ready to insert.
 *
 * @param tx - The transaction client used for the insert.
 * @param thesisBoxId - The target box's database ID.
 * @param articles - The articles to filter and prepare.
 * @returns The prepared insert records and the count of skipped duplicates.
 */
export async function insertLiteratureBatch(
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
      comparisonNote: article.comparisonNote ?? null,
      openalexId: article.openalexId ?? null,
      doi: article.doi?.trim() || null,
      publisher: article.publisher ?? null,
      publicationYear: article.publicationYear ?? null,
      authors: article.authors.filter(Boolean) as string[],
      isRead: false,
      relevanceScore: article.relevanceScore ?? 0,
    });
  }

  return { toInsert, skipped };
}

/**
 * Persists articles directly to the target box using its database ID.
 *
 * @param thesisBoxId - The target sub-box's database ID.
 * @param articles - The articles to persist.
 */
export async function persistSubBoxEntry(
  thesisBoxId: number,
  articles: JuryArticle[],
): Promise<void> {
  await db.transaction(async (tx) => {
    const limit = 4;
    const sorted = [...articles].sort(
      (a, b) => b.relevanceScore - a.relevanceScore,
    );
    const sliced = limit !== undefined ? sorted.slice(0, limit) : sorted;

    const { toInsert } = await insertLiteratureBatch(tx, thesisBoxId, sliced);

    if (toInsert.length > 0) {
      await tx.insert(sources).values(toInsert);
    }
  });
}

/**
 * Confirms the entire literature pool by persisting all entries in a single transaction.
 *
 * @param literaturePool - The pool entries to persist with their thesis box IDs.
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
