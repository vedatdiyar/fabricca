/**
 * Batch orchestrator — coordinates the full multi-box literature review pipeline.
 *
 * Implements the "Entity-First Query + Batch LLM Jury" pipeline:
 *   Phase 1 — Parallel OpenAlex search with rate-limited concurrency
 *   Phase 2 — Single batch LLM jury evaluation + title/author cleaning (combined)
 *   Phase 3 — Jury-based filtering, scoring, deduplication, progressive save
 */

import { Logger } from "@/lib/logger";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import type { JuryArticle, LiteraturePoolEntry } from "@/lib/types";
import type {
  SubBoxInput,
  SubBoxItem,
  RawPaper,
} from "./literature-review-papers";
import {
  searchOpenAlex,
  fetchOpenAlexMetadataBatch,
  healAuthorsByTitle,
} from "./openalex/client";
import { extractCleanDoi, normalizeCleanTitle } from "@/lib/academic/utils";
import { clusterRefMetadata } from "./clustering";
import {
  analyzeReferenceFrequencies,
  type QueueItem,
} from "./selection";
import {
  evaluateBatchJury,
  type JuryBoxContext,
  type JuryInputItem,
} from "./batch-jury";

// ============================================================================
// Public interface
// ============================================================================

export interface BatchOrchestrationResult {
  poolEntries: LiteraturePoolEntry[];
  archivalBoxTitles: string[];
}

interface SubBoxResult {
  boxType: string;
  boxDescription: string;
  subBox: SubBoxItem;
  thesisBoxId: number;
  candidates: QueueItem["candidates"];
  activeWorks: RawPaper[];
  rawPapers: RawPaper[];
}

// ============================================================================
// Core Pipeline Orchestrator
// ============================================================================

  /**
   * Runs the full multi-box literature review pipeline:
   *   Phase 1 — Parallel OpenAlex search + frequency analysis + clustering
   *   Phase 2 — Single batch LLM jury evaluation + title/author cleaning (combined)
   *   Phase 3 — Jury-based selection, deduplication, progressive save
 *
 * @param boxes - All sub-box inputs grouped by parent box
 * @param logger - Logger instance
 * @param thesisMatrixSubject - Thesis subject problem string (ana tez konusu)
 * @param checkCancelled - Cancellation check callback
 * @param persistSubBox - Callback for progressive per-sub-box persistence
 * @returns Aggregated pool entries and archival titles
 */
export async function orchestrateBatchProcess(
  boxes: SubBoxInput[],
  logger: Logger,
  thesisMatrixSubject?: string,
  checkCancelled?: () => boolean,
  persistSubBox?: (
    thesisBoxId: number,
    articles: JuryArticle[],
  ) => Promise<void>,
): Promise<BatchOrchestrationResult> {
  const poolEntries: LiteraturePoolEntry[] = [];
  const archivalBoxTitles: string[] = [];
  const assignedTitles = new Set<string>();
  const limiter = createConcurrencyLimiter(3);

  // ── ARCHIVAL BYPASS ──────────────────────────────────────────────────────
  for (let i = 0; i < boxes.length; i++) {
    if (checkCancelled?.()) break;
    const box = boxes[i];

    if (box.boxType === "PRIMARY_MATERIAL") {
      archivalBoxTitles.push(box.title);
      poolEntries.push({
        subBoxTitle: box.title,
        thesisBoxId: box.id,
        articles: [],
      });
    }
  }

  // ── COLLECT ACTIVE SUB-BOXES ────────────────────────────────────────────
  const activeJobs: { box: SubBoxInput; subBox: SubBoxItem }[] = [];
  for (const box of boxes) {
    if (!box.subBoxes || box.subBoxes.length === 0) continue;
    if (box.boxType === "PRIMARY_MATERIAL") continue;

    for (const subBox of box.subBoxes) {
      activeJobs.push({ box, subBox });
    }
  }

  if (activeJobs.length === 0) {
    return { poolEntries, archivalBoxTitles };
  }

  // ── PHASE 1: PARALLEL CANDIDATE COMPILATION ─────────────────────────────
  logger.info("literature_openalex_search_start");

  const phase1Results = await Promise.allSettled(
    activeJobs.map(({ box, subBox }) =>
      limiter.exec(async (): Promise<SubBoxResult> => {
        const query = subBox.semanticQuery?.trim();

        if (!query) {
          return {
            boxType: box.boxType ?? "PROBLEMATIZATION",
            boxDescription: box.description ?? "",
            subBox,
            thesisBoxId: subBox.thesisBoxId,
            candidates: [],
            activeWorks: [],
            rawPapers: [],
          };
        }

        const rawPapers = await searchOpenAlex(query, 25, checkCancelled);

        const activeWorks = rawPapers.filter(
          (p) =>
            p.referencedWorks &&
            p.referencedWorks.length > 0 &&
            p.title?.trim(),
        );
        const N = activeWorks.length;
        const subBoxCandidates: QueueItem["candidates"] = [];

        if (N > 0) {
          const { leaderIds } = analyzeReferenceFrequencies(activeWorks, N);
          const refMetadata = await fetchOpenAlexMetadataBatch(
            leaderIds,
            checkCancelled,
          );
          const clusters = clusterRefMetadata(refMetadata);

          const mappedCandidates = clusters.slice(0, 5).map((c) => {
            const sortedMembers = [...c.members].sort((a, b) => {
              const hasDoiA = !!a.doi;
              const hasDoiB = !!b.doi;
              if (hasDoiA && !hasDoiB) return -1;
              if (!hasDoiA && hasDoiB) return 1;
              return (b.citedByCount ?? 0) - (a.citedByCount ?? 0);
            });
            const chosen = sortedMembers[0];
            return {
              title: chosen.title,
              authors: chosen.authors,
              year: null,
              openAlexId: chosen.id,
              doi: chosen.doi ? extractCleanDoi(chosen.doi) : null,
              publisher: null,
              cluster: c,
            };
          });

          subBoxCandidates.push(...mappedCandidates);
        }

        // Fallback: If co-citation clustering yields 0 candidates
        if (subBoxCandidates.length === 0 && rawPapers.length > 0) {
          const fallbackCandidates = rawPapers
            .filter((p) => p.title?.trim())
            .slice(0, 5)
            .map((p) => ({
              title: p.title!,
              authors: p.authors,
              year: p.year,
              openAlexId: p.openAlexId ?? "",
              doi: p.doi ? extractCleanDoi(p.doi) : null,
              publisher: p.publisher,
              cluster: {
                id: p.openAlexId ?? "",
                canonicalTitle: p.title ?? "",
                members: [],
                combinedFrequency: 1,
                citingModernIndices: [],
              },
            }));
          subBoxCandidates.push(...fallbackCandidates);
        }

        return {
          boxType: box.boxType ?? "PROBLEMATIZATION",
          boxDescription: box.description ?? "",
          subBox,
          thesisBoxId: subBox.thesisBoxId,
          candidates: subBoxCandidates,
          activeWorks,
          rawPapers,
        };
      }),
    ),
  );

  const fulfilledResults: SubBoxResult[] = [];
  for (const result of phase1Results) {
    if (result.status === "fulfilled") {
      fulfilledResults.push(result.value);
    } else {
      const errorMsg =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      logger.error("literature_phase1_subbox_failed", {
        error: errorMsg,
      });
      throw result.reason;
    }
  }

  logger.info("literature_openalex_search_success");

  // ── PHASE 2: SINGLE BATCH LLM JURY EVALUATION ───────────────────────────
  logger.info("literature_batch_jury_start");

  const juryInputs: JuryInputItem[] = [];
  for (const r of fulfilledResults) {
    if (r.rawPapers.length === 0) continue;
    juryInputs.push({
      box: {
        thesisBoxId: r.thesisBoxId,
        subBoxTitle: r.subBox.title,
        boxType: r.boxType,
        description: r.boxDescription,
      },
      articles: r.rawPapers,
    });
  }

  let juryEvaluations: {
    thesisBoxId: number;
    subBoxTitle: string;
    articleTitle: string;
    openAlexId: string | null;
    isRelevant: boolean;
    relevanceScore: number;
    reason: string;
    cleanedTitle: string;
    cleanedAuthors: string;
  }[] = [];

  if (juryInputs.length > 0) {
    try {
      const subjectProblem = thesisMatrixSubject ?? "";
      const juryResult = await evaluateBatchJury(
        subjectProblem,
        juryInputs,
        logger,
      );
      juryEvaluations = juryResult.evaluations;

      logger.info("literature_batch_jury_success", {
        data: { evaluationCount: juryEvaluations.length },
      });
    } catch (err) {
      logger.error("literature_batch_jury_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  } else {
    logger.info("literature_batch_jury_skipped_no_inputs");
  }

  // ── PHASE 3: JURY-BASED SELECTION, DEDUPLICATION, AND SAVE ──────────────
  // Title/author cleaning is already embedded inside Phase 2 (combined jury+cleaning).
  const subBoxResultsToPersist: {
    subBoxTitle: string;
    thesisBoxId: number;
    articles: JuryArticle[];
  }[] = [];

  logger.info("literature_jury_selection_start");

  // Build lookup: (thesisBoxId + normalized title) → jury evaluation
  const evalLookup = new Map<string, typeof juryEvaluations[0]>();
  for (const ev of juryEvaluations) {
    const normTitle = normalizeCleanTitle(ev.articleTitle);
    const key = `${ev.thesisBoxId}::${normTitle}`;
    if (!evalLookup.has(key)) {
      evalLookup.set(key, ev);
    }
  }

  for (const r of fulfilledResults) {
    if (checkCancelled?.()) break;

    const subBoxArticles: JuryArticle[] = [];

    // Collect all jury evaluations for this sub-box, filter relevant
    const boxEvals = juryEvaluations
      .filter((ev) => ev.thesisBoxId === r.thesisBoxId && ev.isRelevant)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    if (boxEvals.length === 0) {
      subBoxResultsToPersist.push({
        subBoxTitle: r.subBox.title,
        thesisBoxId: r.thesisBoxId,
        articles: [],
      });
      continue;
    }

    // Match evaluations to rawPapers to get full metadata
    const rawPaperByNormTitle = new Map<string, RawPaper>();
    for (const p of r.rawPapers) {
      if (!p.title) continue;
      rawPaperByNormTitle.set(normalizeCleanTitle(p.title), p);
    }

    for (const ev of boxEvals) {
      if (assignedTitles.has(normalizeCleanTitle(ev.articleTitle))) continue;

      const rawPaper = rawPaperByNormTitle.get(
        normalizeCleanTitle(ev.articleTitle),
      );

      subBoxArticles.push({
        title: ev.cleanedTitle,
        authors: ev.cleanedAuthors.split("; ").filter(Boolean),
        publisher: null,
        publicationYear: null,
        doi: rawPaper?.doi ?? null,
        url: ev.openAlexId ?? rawPaper?.openAlexId ?? "",
        relevanceScore: ev.relevanceScore,
        badge: null,
        comparisonNote: ev.reason,
        isFoundational: subBoxArticles.length === 0,
      });

      assignedTitles.add(normalizeCleanTitle(ev.articleTitle));
    }

    // Programmatic Author Healing for articles with empty authors
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
          // Non-fatal: continue with empty authors
        }
      }
    }

    subBoxResultsToPersist.push({
      subBoxTitle: r.subBox.title,
      thesisBoxId: r.thesisBoxId,
      articles: subBoxArticles,
    });
  }

  logger.info("literature_jury_selection_success");

  // ── PROGRESSIVE SAVE ─────────────────────────────────────────────────────
  for (const item of subBoxResultsToPersist) {
    if (checkCancelled?.()) break;

    poolEntries.push({
      subBoxTitle: item.subBoxTitle,
      thesisBoxId: item.thesisBoxId,
      articles: item.articles,
    });

    if (persistSubBox && item.articles.length > 0) {
      try {
        await persistSubBox(item.thesisBoxId, item.articles);
      } catch (err) {
        logger.error("literature_progressive_save_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }
  }

  return { poolEntries, archivalBoxTitles };
}
