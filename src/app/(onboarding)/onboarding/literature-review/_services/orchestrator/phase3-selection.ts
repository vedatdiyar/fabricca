import { Logger } from "@/lib/logger";
import type { JuryArticle } from "@/lib/types";
import { sanitizeTargetedArticles } from "@/core/services/academic";
import { healAuthorsByTitle } from "../openalex/client";
import {
  extractOpenAlexId,
  normalizeCleanTitle,
  stripAltTitle,
} from "@/lib/academic/utils";
import { areTitlesDuplicateByMetric } from "@/lib/academic/title-utils";
import { extractCleanDoi } from "@/lib/academic/identifier-utils";
import { extractSurname } from "@/lib/academic/filename-utils";
import type {
  SubBoxResult,
  PoolItem,
  JuryEvalResult,
  SelectedArticleCandidate,
  SubBoxResultToPersist,
} from "./types";

/**
 * Executes Phase 3 selection with global optimal assignment.
 *
 * İş Kuralı (Step 13):
 * - Bir makale ASLA birden fazla sub-box içinde yer alamaz (Strict 1-to-1).
 * - Her sub-box hedef olarak tam 4 makale ile doldurulmalıdır (quota = 4).
 * - Highest Relevance Affinity: tüm kutular arası en yüksek skorlu eşleşme kazanır.
 *
 * Algoritma:
 *  1. Global skor matrisi oluştur (`{paper, boxId, score}`) ve skora göre azalan sırala.
 *  2. Sırayla ata: makale atanmamış + kutu <4 ise ata ve küresel olarak işaretle.
 *  3. Backfill: primary (>=80) sonrası boş slotlar için secondary (>=75) havuzdan
 *     yine global skor sıralı şekilde doldur.
 *
 * @param fulfilledResults - The Phase 1 search results per sub-box.
 * @param poolByBox - The per-box candidate pools built during Phase 2.
 * @param juryEvaluations - The jury evaluations produced during Phase 2.
 * @param logger - The shared flow logger.
 * @param checkCancelled - Optional cancellation predicate; stops selection when true.
 * @returns The final selected article records per sub-box.
 */
export async function executePhase3Selection(
  fulfilledResults: SubBoxResult[],
  poolByBox: Map<number, PoolItem[]>,
  juryEvaluations: JuryEvalResult[],
  logger: Logger,
  checkCancelled?: () => boolean,
): Promise<SubBoxResultToPersist[]> {
  // Metric-based deduplication: DOI exact OR (Jaccard/Levenshtein >=0.90 AND year±1/first-author)
  const seenDois = new Set<string>();
  const seenPapers: Array<{ title: string; year: number | null; authors: string[]; doi: string | null }> = [];

  const poolLookup = new Map<string, PoolItem>();
  for (const [boxId, pool] of poolByBox) {
    for (const item of pool) {
      const normTitle = normalizeCleanTitle(item.rawPaper.title ?? "");
      const key = `${boxId}::${normTitle}`;
      if (!poolLookup.has(key)) {
        poolLookup.set(key, item);
      }
    }
  }

  const allSelectedArticles: SelectedArticleCandidate[] = [];

  // ── Global assignment state ──────────────────────────────────────────────
  const selectedEvalsByBox = new Map<number, JuryEvalResult[]>();
  for (const r of fulfilledResults) {
    selectedEvalsByBox.set(r.thesisBoxId, []);
  }

  const isDuplicate = (
    title: string,
    year: number | null,
    authors: string[],
    doi: string | null,
  ): boolean => {
    const cleanDoi = doi ? extractCleanDoi(doi) : null;
    if (cleanDoi && seenDois.has(cleanDoi)) return true;
    for (const prev of seenPapers) {
      if (cleanDoi && prev.doi && cleanDoi === prev.doi) return true;
      if (!areTitlesDuplicateByMetric(title, prev.title, 0.90)) continue;
      const yearMatch =
        typeof year === "number" &&
        typeof prev.year === "number" &&
        Math.abs(year - prev.year) <= 1;
      const firstA = authors?.[0] ? extractSurname(authors[0]).toLowerCase() : null;
      const firstB = prev.authors?.[0] ? extractSurname(prev.authors[0]).toLowerCase() : null;
      const hasAuthor = !!firstA && !!firstB && firstA !== "anonim" && firstB !== "anonim";
      const authorMatch = hasAuthor ? firstA === firstB : false;
      const hasMeta = (typeof year === "number" && typeof prev.year === "number") || hasAuthor;
      if (hasMeta ? yearMatch || authorMatch : true) return true;
    }
    return false;
  };

  const markSelected = (
    title: string,
    year: number | null,
    authors: string[],
    doi: string | null,
  ): void => {
    const cleanDoi = doi ? extractCleanDoi(doi) : null;
    if (cleanDoi) seenDois.add(cleanDoi);
    seenPapers.push({ title, year, authors: authors ?? [], doi: cleanDoi });
  };

  type ScoredEntry = { ev: JuryEvalResult; boxId: number; score: number };

  const getPoolMeta = (
    ev: JuryEvalResult,
  ): { poolItem: PoolItem | undefined; year: number | null; authors: string[]; doi: string | null } => {
    const poolKey = `${ev.thesisBoxId}::${normalizeCleanTitle(ev.articleTitle)}`;
    const poolItem = poolLookup.get(poolKey);
    return {
      poolItem,
      year: poolItem?.rawPaper.year ?? null,
      authors: poolItem?.rawPaper.authors ?? [],
      doi: poolItem?.rawPaper.doi ?? ev.openAlexId ?? null,
    };
  };

  const tryAssignEntry = (entry: ScoredEntry): boolean => {
    const { ev, boxId } = entry;
    const bucket = selectedEvalsByBox.get(boxId);
    if (!bucket || bucket.length >= 4) return false;
    const { poolItem, year, authors, doi } = getPoolMeta(ev);
    if (!poolItem) return false;
    if (isDuplicate(ev.articleTitle, year, authors, doi)) return false;
    markSelected(ev.articleTitle, year, authors, doi);
    bucket.push(ev);
    return true;
  };

  // ── Step 2: Global skor matrisi ve öncelikli eşleştirme (primary >=80) ──
  const primaryEntries: ScoredEntry[] = [];
  for (const r of fulfilledResults) {
    if (checkCancelled?.()) break;
    const boxPrimary = juryEvaluations.filter(
      (ev) => ev.thesisBoxId === r.thesisBoxId && ev.isRelevant && ev.relevanceScore >= 80,
    );
    for (const ev of boxPrimary) {
      primaryEntries.push({ ev, boxId: r.thesisBoxId, score: ev.relevanceScore });
    }
  }
  primaryEntries.sort((a, b) => b.score - a.score);

  for (const entry of primaryEntries) {
    if (checkCancelled?.()) break;
    tryAssignEntry(entry);
  }

  // ── Step 3: Alt kutuları doldurma garantisi — secondary backfill (75–79) ──
  const needsBackfill = Array.from(selectedEvalsByBox.values()).some((arr) => arr.length < 4);
  if (needsBackfill) {
    const secondaryEntries: ScoredEntry[] = [];
    for (const r of fulfilledResults) {
      if (checkCancelled?.()) break;
      const bucket = selectedEvalsByBox.get(r.thesisBoxId);
      if (!bucket || bucket.length >= 4) continue;
      const boxSecondary = juryEvaluations.filter(
        (ev) =>
          ev.thesisBoxId === r.thesisBoxId &&
          ev.isRelevant &&
          ev.relevanceScore >= 75 &&
          ev.relevanceScore < 80,
      );
      for (const ev of boxSecondary) {
        secondaryEntries.push({ ev, boxId: r.thesisBoxId, score: ev.relevanceScore });
      }
    }
    secondaryEntries.sort((a, b) => b.score - a.score);

    for (const entry of secondaryEntries) {
      if (checkCancelled?.()) break;
      const bucket = selectedEvalsByBox.get(entry.boxId);
      if (!bucket || bucket.length >= 4) continue;
      tryAssignEntry(entry);
    }
  }

  // ── Collect selected evals into flat candidate list ─────────────────────
  for (const r of fulfilledResults) {
    if (checkCancelled?.()) break;
    const selectedEvals = selectedEvalsByBox.get(r.thesisBoxId) ?? [];
    if (selectedEvals.length === 0) continue;

    for (const ev of selectedEvals) {
      const normTitle = normalizeCleanTitle(ev.articleTitle);
      const poolKey = `${ev.thesisBoxId}::${normTitle}`;
      const poolItem = poolLookup.get(poolKey);
      if (!poolItem) continue;

      const rawTitle = poolItem.rawPaper.title ?? ev.articleTitle;
      const cleanTitle = stripAltTitle(rawTitle) || rawTitle;

      allSelectedArticles.push({
        thesisBoxId: ev.thesisBoxId,
        subBoxTitle: ev.subBoxTitle,
        originalTitle: cleanTitle,
        originalAuthors: poolItem.rawPaper.authors,
        relevanceScore: ev.relevanceScore,
        reasoning: ev.reasoning,
        doi: poolItem.rawPaper.doi,
        openalexId:
          extractOpenAlexId(poolItem.rawPaper.openAlexId) ??
          extractOpenAlexId(ev.openAlexId) ??
          null,
        publisher: poolItem.rawPaper.publisher,
        publicationYear: poolItem.rawPaper.year,
        originalAbstract: poolItem.rawPaper.abstract ?? null,
        poolItem,
      });
    }
  }

  if (allSelectedArticles.length > 0) {
    const sanitizeInput = allSelectedArticles.map((a) => ({
      title: a.originalTitle,
      author: a.originalAuthors.join(", "),
    }));

    let sanitized: { title: string; author: string }[] = [];

    try {
      sanitized = await sanitizeTargetedArticles(sanitizeInput, logger);
    } catch (err) {
      logger.error("literature_targeted_sanitization_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    for (let i = 0; i < allSelectedArticles.length; i++) {
      const art = allSelectedArticles[i];
      const cleaned = sanitized[i];

      if (cleaned) {
        art.originalTitle = cleaned.title;
        art.originalAuthors = cleaned.author.split(", ").filter(Boolean);
      }
    }
  }

  const selectedByBox = new Map<number, SelectedArticleCandidate[]>();

  for (const art of allSelectedArticles) {
    const list = selectedByBox.get(art.thesisBoxId) ?? [];
    list.push(art);
    selectedByBox.set(art.thesisBoxId, list);
  }

  const subBoxResultsToPersist: SubBoxResultToPersist[] = [];

  for (const r of fulfilledResults) {
    if (checkCancelled?.()) break;

    const boxSelected = selectedByBox.get(r.thesisBoxId) ?? [];
    const subBoxArticles: JuryArticle[] = [];

    for (const art of boxSelected) {
      const isQdrantThesis = art.poolItem.rawPaper.source === "qdrant";
      const juryArticle: JuryArticle = {
        title: stripAltTitle(art.originalTitle) || art.originalTitle,
        authors: art.originalAuthors,
        publisher: isQdrantThesis ? art.publisher : null,
        thesisType:
          art.poolItem.rawPaper.publicationType ||
          (isQdrantThesis ? "Tez" : "Makale"),
        publicationYear: isQdrantThesis ? art.publicationYear : null,
        doi: art.doi,
        openalexId: art.openalexId,
        relevanceScore: art.relevanceScore,
        comparisonNote: art.reasoning,
        abstract: art.originalAbstract ?? null,
      };

      subBoxArticles.push(juryArticle);
    }

    for (const art of subBoxArticles) {
      if (art.authors.length === 0 && !checkCancelled?.()) {
        try {
          const healed = await healAuthorsByTitle(art.title);
          if (healed && healed.length > 0) {
            art.authors = healed;
          }
        } catch (err) {
          logger.error("literature_author_healing_failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    subBoxResultsToPersist.push({
      subBoxTitle: r.subBox.title,
      thesisBoxId: r.thesisBoxId,
      articles: subBoxArticles,
    });
  }

  return subBoxResultsToPersist;
}
