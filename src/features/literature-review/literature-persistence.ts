import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { boxes, matrices, positioning, sources } from "@/db/schema";
import { BOX_TYPE_DESCRIPTIONS } from "@/lib/box-constants";
import { normalizeTitle } from "@/lib/academic/utils";
import type { LiteraturePoolEntry, JuryArticle } from "@/lib/types";
import type { NewSource } from "@/db/schema";
import type { RecommendedThesisItem } from "@/features/positioning/validation";

export type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Display title of the parent box holding strategic guide theses. */
const RELATED_THESES_TITLE = "İlgili Tezler";

/**
 * Returns only the primary language portion of a thesis title by cutting it at
 * the " / " separator (YÖK stores titles as "Türkçe / English").
 *
 * @param title - The raw thesis title to clean.
 * @returns The primary (Turkish) title fragment, or the raw title when unchanged.
 */
function cleanThesisTitle(title: string): string {
  const separatorIndex = title.indexOf(" / ");
  return separatorIndex === -1 ? title : title.slice(0, separatorIndex).trim();
}

/**
 * Persists the strategic guide theses from the positioning report into the
 * sources table under a dedicated RELATED_THESES box, creating the box on
 * demand and replacing any prior entries. Runs together with the literature
 * review so the sources pool only fills once the review is performed.
 *
 * @param userId - The id of the user owning the theses.
 */
export async function persistRelatedTheses(userId: number): Promise<void> {
  const [matrix] = await db
    .select({ id: matrices.id })
    .from(matrices)
    .where(eq(matrices.userId, userId))
    .limit(1);

  if (!matrix) {
    return;
  }

  const [positioningRow] = await db
    .select({ recommendedTheses: positioning.recommendedTheses })
    .from(positioning)
    .where(eq(positioning.userId, userId))
    .limit(1);

  const theses = (positioningRow?.recommendedTheses ??
    []) as RecommendedThesisItem[];
  if (theses.length === 0) {
    return;
  }

  await db.transaction(async (tx) => {
    let [relatedBox] = await tx
      .select({ id: boxes.id })
      .from(boxes)
      .where(
        and(eq(boxes.matrixId, matrix.id), eq(boxes.boxType, "RELATED_THESES")),
      )
      .limit(1);

    if (!relatedBox) {
      const [inserted] = await tx
        .insert(boxes)
        .values({
          matrixId: matrix.id,
          parentId: null,
          boxType: "RELATED_THESES",
          title: RELATED_THESES_TITLE,
          description: BOX_TYPE_DESCRIPTIONS.RELATED_THESES,
          semanticQuery: null,
          concepts: [],
        })
        .returning({ id: boxes.id });
      relatedBox = inserted;
    }

    if (!relatedBox) {
      return;
    }

    await tx.delete(sources).where(eq(sources.boxId, relatedBox.id));

    const toInsert = theses.map((t) => ({
      boxId: relatedBox.id,
      title: cleanThesisTitle(t.title),
      authors: [t.author].filter((a) => a.length > 0),
      publisher: t.university || null,
      thesisType: t.thesisType || null,
      publicationYear: t.year,
      doi: t.doi || null,
      comparisonNote:
        [t.contributionArea, t.relevanceReason]
          .filter((s) => s && s.trim().length > 0)
          .join("\n") || null,
      isRead: false,
      relevanceScore: 100,
    }));

    if (toInsert.length > 0) {
      await tx.insert(sources).values(toInsert);
    }
  });
}

/**
 * Loads existing records for a box, deduplicates new articles by title/DOI, and returns the records ready to insert.
 *
 * @param tx - The transaction client used for the insert.
 * @param thesisBoxId - The target box's database ID.
 * @param articles - The articles to filter and prepare.
 * @returns The prepared insert records and the count of skipped duplicates.
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
      comparisonNote: sources.comparisonNote,
      openalexId: sources.openalexId,
      doi: sources.doi,
      publisher: sources.publisher,
      thesisType: sources.thesisType,
      publicationYear: sources.publicationYear,
      authors: sources.authors,
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
      openalexId: row.openalexId ?? null,
      doi: row.doi,
      publisher: row.publisher ?? "",
      thesisType: row.thesisType ?? null,
      publicationYear: row.publicationYear ?? 0,
      authors: (row.authors as string[]) ?? [],
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
