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
 * Executes Phase 3 selection with strict per-box isolation.
 *
 * İş Kuralı (güncellendi — kullanıcı isteği: kutular asla sızmamalı):
 * - Her sub-box kendi havuzundan bağımsız `quota=4` seçer (global skor matrisi yok).
 * - Deduplication kutu içinde yapılır (DOI/title), kutular arası global dedup kaldırıldı.
 * - Sıra: primary (>=80) skor sıralı, sonra secondary (75-79) backfill.
 *
 * @param fulfilledResults - The Phase 1 search results per sub-box.
 * @param poolByBox - The per-box candidate pools built during Phase 2.
 * @param juryEvaluations - The jury evaluations produced during Phase 2.
 * @param logger - The shared flow logger.
 * @param checkCancelled - Optional cancellation predicate; stops selection when true.
 * @returns The final selected article records per sub-box.
 */
/**
 * Calculates deterministic composite score within a jury tier.
 * Formula: S_Final = S_Cohere * (1 + 0.15 * S_Citation)
 *
 * - S_Cohere in [0..1]: Cross-encoder relevance score from Cohere Rerank v4.0 Pro.
 * - S_Citation in [0..1]: Log-normalized citation power for OpenAlex; 0 for national theses (Qdrant).
 * - S_Recency is removed per architectural decision (penalized foundational works).
 *
 * @param paper - The raw paper candidate.
 * @returns Final composite score.
 */
export function calculateCompositeScore(
  paper: import("../literature-review-papers").RawPaper,
): number {
  const rawScore = (paper as { relevanceScore?: number }).relevanceScore;
  const sCohere =
    typeof rawScore === "number" && Number.isFinite(rawScore) && rawScore > 0
      ? Math.min(1, Math.max(0, rawScore))
      : 0.5;

  let sCitation = 0;
  if (paper.source === "openalex") {
    const citations = paper.citedByCount ?? 0;
    sCitation = Math.min(1.0, Math.log10(citations + 1) / 3.5);
  }

  return sCohere * (1 + 0.15 * sCitation);
}

export async function executePhase3Selection(
  fulfilledResults: SubBoxResult[],
  poolByBox: Map<number, PoolItem[]>,
  juryEvaluations: JuryEvalResult[],
  logger: Logger,
  checkCancelled?: () => boolean,
): Promise<SubBoxResultToPersist[]> {

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

  // ── Per-box assignment state (strict isolation) ──────────────────────────
  const selectedEvalsByBox = new Map<number, JuryEvalResult[]>();
  for (const r of fulfilledResults) {
    selectedEvalsByBox.set(r.thesisBoxId, []);
  }

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

  function isTitleSubset(titleA: string, titleB: string): boolean {
    const normA = normalizeCleanTitle(titleA).toLowerCase();
    const normB = normalizeCleanTitle(titleB).toLowerCase();
    if (normA.length >= 10 && normB.length >= 10) {
      if (normA.includes(normB) || normB.includes(normA)) return true;
    }
    return false;
  }

  function getBaseDoi(cleanDoi: string): string {
    return cleanDoi.replace(/[-_][0-9]{2,4}$/, "").replace(/\/ch[0-9]+$/i, "");
  }

  // Per-box dedup helpers (isolated per box)
  const makeBoxDedup = () => {
    const seenDois = new Set<string>();
    const seenBaseDois = new Set<string>();
    const seenPapers: Array<{
      title: string;
      year: number | null;
      authors: string[];
      doi: string | null;
    }> = [];

    return {
      isDuplicate: (
        title: string,
        year: number | null,
        authors: string[],
        doi: string | null,
      ): boolean => {
        const cleanDoi = doi ? extractCleanDoi(doi) : null;
        if (cleanDoi) {
          if (seenDois.has(cleanDoi)) return true;
          const baseDoi = getBaseDoi(cleanDoi);
          if (seenBaseDois.has(baseDoi) && cleanDoi !== baseDoi) return true;
        }

        const firstA = authors?.[0]
          ? extractSurname(authors[0]).toLowerCase()
          : null;

        for (const prev of seenPapers) {
          if (cleanDoi && prev.doi && cleanDoi === prev.doi) return true;

          const firstB = prev.authors?.[0]
            ? extractSurname(prev.authors[0]).toLowerCase()
            : null;
          const sameAuthor =
            !!firstA &&
            !!firstB &&
            firstA !== "anonim" &&
            firstB !== "anonim" &&
            firstA === firstB;

          // Same author title subset collapse (e.g. journal article vs full book title)
          if (sameAuthor && isTitleSubset(title, prev.title)) return true;
          if (!areTitlesDuplicateByMetric(title, prev.title, 0.9)) continue;

          const yearMatch =
            typeof year === "number" &&
            typeof prev.year === "number" &&
            Math.abs(year - prev.year) <= 1;
          const hasMeta =
            (typeof year === "number" && typeof prev.year === "number") ||
            sameAuthor;
          if (hasMeta ? yearMatch || sameAuthor : true) return true;
        }
        return false;
      },
      markSelected: (
        title: string,
        year: number | null,
        authors: string[],
        doi: string | null,
      ): void => {
        const cleanDoi = doi ? extractCleanDoi(doi) : null;
        if (cleanDoi) {
          seenDois.add(cleanDoi);
          seenBaseDois.add(getBaseDoi(cleanDoi));
        }
        seenPapers.push({ title, year, authors: authors ?? [], doi: cleanDoi });
      },
    };
  };

  // ── Step 2 & 3: Per-box Tier 1 + Tier 2 selection with multiplicative composite score ──
  for (const r of fulfilledResults) {
    if (checkCancelled?.()) break;
    const boxEvals = juryEvaluations.filter(
      (ev) => ev.thesisBoxId === r.thesisBoxId && ev.isRelevant,
    );

    const getScore = (ev: JuryEvalResult): number => {
      const { poolItem } = getPoolMeta(ev);
      return poolItem ? calculateCompositeScore(poolItem.rawPaper) : 0;
    };

    const tier1 = boxEvals
      .filter(
        (ev) => ev.tier === "TIER_1" || (!ev.tier && ev.relevanceScore >= 80),
      )
      .sort((a, b) => getScore(b) - getScore(a));

    const tier2 = boxEvals
      .filter(
        (ev) =>
          ev.tier === "TIER_2" ||
          (!ev.tier && ev.relevanceScore >= 70 && ev.relevanceScore < 80),
      )
      .sort((a, b) => getScore(b) - getScore(a));

    const dedup = makeBoxDedup();
    const bucket = selectedEvalsByBox.get(r.thesisBoxId)!;

    const tryAssign = (ev: JuryEvalResult): boolean => {
      if (bucket.length >= 4) return false;
      const { poolItem, year, authors, doi } = getPoolMeta(ev);
      if (!poolItem) return false;
      if (dedup.isDuplicate(ev.articleTitle, year, authors, doi)) return false;
      dedup.markSelected(ev.articleTitle, year, authors, doi);
      bucket.push(ev);
      return true;
    };

    for (const ev of tier1) {
      if (checkCancelled?.()) break;
      if (bucket.length >= 4) break;
      tryAssign(ev);
    }
    if (bucket.length < 4) {
      for (const ev of tier2) {
        if (checkCancelled?.()) break;
        if (bucket.length >= 4) break;
        tryAssign(ev);
      }
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

      const compositeScore = calculateCompositeScore(poolItem.rawPaper);
      const compositeRelevanceScore = Math.min(
        100,
        Math.max(1, Math.round(compositeScore * 100)),
      );

      allSelectedArticles.push({
        thesisBoxId: ev.thesisBoxId,
        subBoxTitle: ev.subBoxTitle,
        originalTitle: cleanTitle,
        originalAuthors: poolItem.rawPaper.authors,
        relevanceScore: compositeRelevanceScore,
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
        publisher: art.publisher ?? null,
        thesisType:
          art.poolItem.rawPaper.publicationType ||
          (isQdrantThesis ? "Tez" : "Makale"),
        publicationYear: art.publicationYear ?? null,
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
