import { Logger } from "@/lib/logger";
import type { JuryArticle } from "@/lib/types";
import { sanitizeTargetedArticles } from "@/core/services/academic";
import { healAuthorsByTitle } from "../openalex/client";
import {
  extractOpenAlexId,
  normalizeCleanTitle,
  areTitlesSimilar,
} from "@/lib/academic/utils";
import type {
  SubBoxResult,
  PoolItem,
  JuryEvalResult,
  SelectedArticleCandidate,
  SubBoxResultToPersist,
} from "./types";

/**
 * Executes Phase 3 selection, filtering jury evaluations into the final articles
 * to persist for each sub-box.
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
  const assignedTitles = new Set<string>();
  const assignedRawTitles: string[] = [];

  const subBoxResultsToPersist: SubBoxResultToPersist[] = [];

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

  for (const r of fulfilledResults) {
    if (checkCancelled?.()) break;

    const boxEvals = juryEvaluations
      .filter((ev) => ev.thesisBoxId === r.thesisBoxId)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    if (boxEvals.length === 0) {
      subBoxResultsToPersist.push({
        subBoxTitle: r.subBox.title,
        thesisBoxId: r.thesisBoxId,
        articles: [],
      });
      continue;
    }

    // Strict seed quality: Prefer high-confidence relevant candidates (>= 80)
    const primaryEvals = boxEvals.filter(
      (ev) => ev.isRelevant && ev.relevanceScore >= 80,
    );
    const secondaryEvals = boxEvals.filter(
      (ev) => ev.isRelevant && ev.relevanceScore >= 75 && ev.relevanceScore < 80,
    );

    const isDuplicate = (title: string): boolean => {
      const normTitle = normalizeCleanTitle(title);
      if (assignedTitles.has(normTitle)) return true;
      for (const raw of assignedRawTitles) {
        if (areTitlesSimilar(title, raw, 0.8)) return true;
      }
      return false;
    };

    const markSelected = (title: string): void => {
      assignedTitles.add(normalizeCleanTitle(title));
      assignedRawTitles.push(title);
    };

    const selectedEvals: typeof boxEvals = [];

    const tryAdd = (ev: (typeof boxEvals)[0]): boolean => {
      if (selectedEvals.length >= 4) return false;
      if (isDuplicate(ev.articleTitle)) return false;
      const poolKey = `${ev.thesisBoxId}::${normalizeCleanTitle(ev.articleTitle)}`;
      if (!poolLookup.has(poolKey)) return false;
      markSelected(ev.articleTitle);
      selectedEvals.push(ev);
      return true;
    };

    for (const ev of primaryEvals) {
      if (selectedEvals.length >= 4) break;
      tryAdd(ev);
    }

    // Only fallback to relevant candidates with score >= 75 if needed; never take eliminated/irrelevant papers
    if (selectedEvals.length < 4) {
      for (const ev of secondaryEvals) {
        if (selectedEvals.length >= 4) break;
        tryAdd(ev);
      }
    }

    if (selectedEvals.length === 0) {
      subBoxResultsToPersist.push({
        subBoxTitle: r.subBox.title,
        thesisBoxId: r.thesisBoxId,
        articles: [],
      });
      continue;
    }

    for (let idx = 0; idx < selectedEvals.length; idx++) {
      const ev = selectedEvals[idx];
      const normTitle = normalizeCleanTitle(ev.articleTitle);
      const poolKey = `${ev.thesisBoxId}::${normTitle}`;
      const poolItem = poolLookup.get(poolKey);

      if (!poolItem) continue;

      allSelectedArticles.push({
        thesisBoxId: ev.thesisBoxId,
        subBoxTitle: ev.subBoxTitle,
        originalTitle: poolItem.rawPaper.title ?? ev.articleTitle,
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

  for (const r of fulfilledResults) {
    if (checkCancelled?.()) break;

    const boxSelected = selectedByBox.get(r.thesisBoxId) ?? [];
    const subBoxArticles: JuryArticle[] = [];

    for (const art of boxSelected) {
      const juryArticle: JuryArticle = {
        title: art.originalTitle,
        authors: art.originalAuthors,
        publisher: art.publisher,
        thesisType:
          art.poolItem.rawPaper.publicationType ||
          (art.poolItem.rawPaper.source === "qdrant" ? "Tez" : "Makale"),
        publicationYear: art.publicationYear,
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
