import { eq } from "drizzle-orm";
import { db } from "@/db";
import { thesisBoxes, libraryResources } from "@/db/schema";
import { normalizeTitle } from "@/lib/academic/utils";
import type { LiteraturePoolEntry, JuryArticle } from "@/lib/types";
import type { NewLibraryResource } from "@/db/schema";
import { Logger } from "@/lib/logger";
import { sanitizeAcademicDataBulk } from "@/lib/services/academic-sanitizer";
import { buildBoxMap } from "../_lib/box-loader";

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
): Promise<{ toInsert: NewLibraryResource[]; skipped: number }> {
  const existingRecords = await tx
    .select({ title: libraryResources.title, doi: libraryResources.doi })
    .from(libraryResources)
    .where(eq(libraryResources.thesisBoxId, thesisBoxId));

  const existingTitleSet = new Set(
    existingRecords.map((r) => normalizeTitle(r.title)).filter(Boolean),
  );
  const existingDoiSet = new Set(
    existingRecords
      .map((r) => r.doi?.toLowerCase().trim())
      .filter((d): d is string => !!d),
  );

  const toInsert: NewLibraryResource[] = [];
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
      thesisBoxId,
      title: article.title,
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
 * Sanitizes a batch of articles and persists them to the database inside
 * a transaction. Used for progressive save during the pipeline.
 *
 * @param thesisMatrixId - The thesis matrix DB id
 * @param subBoxTitle - The target sub-box title
 * @param articles - Articles to persist
 * @param logger - Optional Logger instance for structured LLM call logging
 */
export async function persistSubBoxEntry(
  thesisMatrixId: number,
  subBoxTitle: string,
  articles: JuryArticle[],
  logger?: Logger,
): Promise<void> {
  // Sanitize
  if (articles.length > 0) {
    const sanitized = await sanitizeAcademicDataBulk(
      articles.map((a) => ({
        title: a.title,
        author: a.authors.join(", "),
      })),
      logger,
    );
    for (let k = 0; k < articles.length; k++) {
      if (sanitized[k]) {
        articles[k].title = sanitized[k].title;
        articles[k].authors = sanitized[k].author
          .split(", ")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }

  // Sort and slice
  const sorted = [...articles]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 4);

  // Persist in transaction
  await db.transaction(async (tx) => {
    const allBoxes = await tx
      .select({ id: thesisBoxes.id, title: thesisBoxes.title })
      .from(thesisBoxes)
      .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

    const boxMap = buildBoxMap(allBoxes);
    const thesisBoxId = boxMap.get(subBoxTitle);

    if (!thesisBoxId) {
      throw new Error(
        `Sub-box not found: "${subBoxTitle}". Please restart the onboarding process.`,
      );
    }

    const { toInsert } = await insertLiteratureBatch(tx, thesisBoxId, sorted);

    if (toInsert.length > 0) {
      await tx.insert(libraryResources).values(toInsert);
    }
  });
}

/**
 * Confirms the entire literature pool by persisting all entries in a single
 * transaction. This is called at the end of the pipeline; entries that were
 * already progressively saved are skipped via dedup.
 *
 * @param thesisMatrixId - The thesis matrix DB id
 * @param literaturePool - Pool entries to persist
 * @param onWarn - Optional warning callback
 * @param logger - Optional Logger instance for structured LLM call logging
 */
export async function persistLiteraturePool(
  thesisMatrixId: number,
  literaturePool: LiteraturePoolEntry[],
  onWarn?: (message: string, data?: Record<string, unknown>) => void,
  logger?: Logger,
): Promise<void> {
  // Batch sanitization
  const allSanitizeTargets: {
    entryIdx: number;
    articleIdx: number;
    article: JuryArticle;
  }[] = [];
  for (let i = 0; i < literaturePool.length; i++) {
    const entry = literaturePool[i];
    for (let j = 0; j < entry.articles.length; j++) {
      allSanitizeTargets.push({
        entryIdx: i,
        articleIdx: j,
        article: entry.articles[j],
      });
    }
  }
  if (allSanitizeTargets.length > 0) {
    const sanitized = await sanitizeAcademicDataBulk(
      allSanitizeTargets.map((t) => ({
        title: t.article.title,
        author: t.article.authors.join(", "),
      })),
      logger,
    );
    for (let k = 0; k < allSanitizeTargets.length; k++) {
      if (sanitized[k]) {
        const target =
          literaturePool[allSanitizeTargets[k].entryIdx].articles[
            allSanitizeTargets[k].articleIdx
          ];
        target.title = sanitized[k].title;
        target.authors = sanitized[k].author
          .split(", ")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }

  // Collect top 4 per entry
  const allTopArticles: { entryIdx: number; article: JuryArticle }[] = [];
  for (let i = 0; i < literaturePool.length; i++) {
    const entry = literaturePool[i];
    const sorted = [...entry.articles]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 4);
    for (const article of sorted) {
      allTopArticles.push({ entryIdx: i, article });
    }
  }

  // Transactional persist
  await db.transaction(async (tx) => {
    const allBoxes = await tx
      .select({ id: thesisBoxes.id, title: thesisBoxes.title })
      .from(thesisBoxes)
      .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

    const boxMap = buildBoxMap(allBoxes);

    const entryArticleMap = new Map<number, JuryArticle[]>();
    for (const { entryIdx, article } of allTopArticles) {
      const list = entryArticleMap.get(entryIdx) ?? [];
      list.push(article);
      entryArticleMap.set(entryIdx, list);
    }

    const skippedResults = await Promise.all(
      literaturePool.map(async (entry, idx) => {
        const thesisBoxId = boxMap.get(entry.subBoxTitle);
        if (!thesisBoxId) {
          throw new Error(
            `Sub-box not found: "${entry.subBoxTitle}". Please restart the onboarding process.`,
          );
        }

        const articles = entryArticleMap.get(idx) ?? [];

        const { toInsert, skipped } = await insertLiteratureBatch(
          tx,
          thesisBoxId,
          articles,
        );

        if (toInsert.length > 0) {
          await tx.insert(libraryResources).values(toInsert);
        }

        return skipped;
      }),
    );

    const totalSkipped = skippedResults.reduce(
      (sum, current) => sum + current,
      0,
    );

    if (totalSkipped > 0) {
      onWarn?.("confirm_literature_duplicates_total", { totalSkipped });
    }
  });
}

/**
 * Persists archive entries (PRIMARY_MATERIAL / CONTEXT) to the database
 * inside a single transaction.
 */
export async function persistArchiveEntries(
  thesisMatrixId: number,
  entries: { subBoxTitle: string; articles: JuryArticle[] }[],
  onWarn?: (message: string, data?: Record<string, unknown>) => void,
): Promise<void> {
  await db.transaction(async (tx) => {
    const allBoxes = await tx
      .select({ id: thesisBoxes.id, title: thesisBoxes.title })
      .from(thesisBoxes)
      .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

    const boxMap = buildBoxMap(allBoxes);

    const insertionPromises = entries.map(async (entry) => {
      const thesisBoxId = boxMap.get(entry.subBoxTitle);

      if (!thesisBoxId) {
        onWarn?.("append_archive_no_box_match", {
          subBoxTitle: entry.subBoxTitle,
        });
        return 0;
      }

      const { toInsert, skipped } = await insertLiteratureBatch(
        tx,
        thesisBoxId,
        entry.articles,
      );

      if (toInsert.length > 0) {
        await tx.insert(libraryResources).values(toInsert);
      }

      return skipped;
    });

    const skippedResults = await Promise.all(insertionPromises);
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
      boxTitle: thesisBoxes.title,
      title: libraryResources.title,
      comparisonNote: libraryResources.comparisonNote,
      badge: libraryResources.badge,
      url: libraryResources.url,
      doi: libraryResources.doi,
      publisher: libraryResources.publisher,
      publicationYear: libraryResources.publicationYear,
      authors: libraryResources.authors,
      isFoundational: libraryResources.isFoundational,
      relevanceScore: libraryResources.relevanceScore,
    })
    .from(libraryResources)
    .innerJoin(thesisBoxes, eq(libraryResources.thesisBoxId, thesisBoxes.id))
    .where(eq(thesisBoxes.thesisMatrixId, thesisMatrixId));

  const grouped = new Map<string, JuryArticle[]>();
  for (const row of rows) {
    const list = grouped.get(row.boxTitle) ?? [];
    list.push({
      title: row.title,
      comparisonNote: row.comparisonNote ?? null,
      badge: row.badge ?? null,
      url: row.url ?? "",
      doi: row.doi,
      publisher: row.publisher ?? "",
      publicationYear: row.publicationYear ?? 0,
      authors: (row.authors as string[]) ?? [],
      isFoundational: row.isFoundational ?? false,
      relevanceScore: row.relevanceScore ?? 0,
    });
    grouped.set(row.boxTitle, list);
  }

  for (const [, articles] of grouped) {
    articles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    if (articles.length > 4) articles.length = 4;
  }

  const pool: LiteraturePoolEntry[] = [];
  for (const [subBoxTitle, articles] of grouped) {
    pool.push({ subBoxTitle, articles });
  }

  return pool;
}
