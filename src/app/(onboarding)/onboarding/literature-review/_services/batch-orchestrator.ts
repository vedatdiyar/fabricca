/**
 * Batch orchestrator — coordinates the full multi-box literature review pipeline.
 *
 * Implements the "Universal Single-Call OpenAlex Reverse Citation Engineering"
 * pipeline. Sub-boxes are processed in parallel via a concurrency limiter,
 * and each sub-box result is progressively persisted to the database.
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
import { selectFoundationalWorksBulk } from "./foundational-oracle";
import { clusterRefMetadata, type Cluster } from "./clustering";
import {
  analyzeReferenceFrequencies,
  selectRelatedArticles,
  type QueueItem,
} from "./selection";
import { sanitizeAcademicDataBulk } from "@/lib/services/academic-sanitizer";

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
 *   Phase 2 — Bulk foundational work selection (Gemini)
 *   Phase 3 — Per-sub-box related-article selection + progressive save
 *
 * @param boxes - All sub-box inputs grouped by parent box
 * @param logger - Logger instance
 * @param thesisArticlesMap - Preloaded RELATED_THESES articles (optional)
 * @param checkCancelled - Cancellation check callback
 * @param persistSubBox - Callback for progressive per-sub-box persistence
 * @returns Aggregated pool entries and archival titles
 */
export async function orchestrateBatchProcess(
  boxes: SubBoxInput[],
  logger: Logger,
  thesisArticlesMap?: Map<string, JuryArticle[]>,
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

    if (
      box.boxType === "PRIMARY_MATERIAL" ||
      box.boxType === "RELATED_THESES"
    ) {
      archivalBoxTitles.push(box.title);
      const articles =
        box.boxType === "RELATED_THESES"
          ? (thesisArticlesMap?.get(box.title) ?? [])
          : [];

      poolEntries.push({
        subBoxTitle: box.title,
        thesisBoxId: box.id,
        articles,
      });
    }
  }

  // ── COLLECT ACTIVE SUB-BOXES ────────────────────────────────────────────
  const activeJobs: { box: SubBoxInput; subBox: SubBoxItem }[] = [];
  for (const box of boxes) {
    if (!box.subBoxes || box.subBoxes.length === 0) continue;
    if (box.boxType === "PRIMARY_MATERIAL" || box.boxType === "RELATED_THESES")
      continue;

    for (const subBox of box.subBoxes) {
      activeJobs.push({ box, subBox });
    }
  }

  if (activeJobs.length === 0) {
    return { poolEntries, archivalBoxTitles };
  }

  // ── PHASE 1: PARALLEL CANDIDATE COMPILATION ─────────────────────────────
  logger.info("literature_batch_search_start", {
    service: "literature",
    filePath: "onboarding/literature-review/_services/batch-orchestrator.ts",
    data: { jobCount: activeJobs.length },
  });

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
          const { leaderIds, refToModernIdx } = analyzeReferenceFrequencies(
            activeWorks,
            N,
          );
          const refMetadata = await fetchOpenAlexMetadataBatch(
            leaderIds,
            checkCancelled,
          );
          const clusters = clusterRefMetadata(refMetadata, refToModernIdx);

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
              authors: chosen.authors.join(", "),
              year: null,
              openAlexId: chosen.id,
              doi: chosen.doi ? extractCleanDoi(chosen.doi) : null,
              publisher: null,
              cluster: c,
            };
          });

          subBoxCandidates.push(...mappedCandidates);
        }

        // Fallback: If co-citation clustering yields 0 candidates (e.g., OpenAlex lacks referencedWorks trees),
        // populate candidates directly from top rawPapers so Gemini Jury can select a Foundational Work.
        if (subBoxCandidates.length === 0 && rawPapers.length > 0) {
          const fallbackCandidates = rawPapers
            .filter((p) => p.title?.trim())
            .slice(0, 5)
            .map((p) => ({
              title: p.title!,
              authors: p.authors.join(", "),
              year: p.year,
              openAlexId: p.openAlexId ?? "",
              doi: p.doi ? extractCleanDoi(p.doi) : null,
              publisher: p.publisher,
              cluster: {
                surname: p.authors[0] ?? "Unknown",
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
        service: "literature",
        filePath:
          "onboarding/literature-review/_services/batch-orchestrator.ts",
        error: errorMsg,
      });
      throw result.reason;
    }
  }

  logger.info("literature_batch_search_success", {
    service: "literature",
    filePath: "onboarding/literature-review/_services/batch-orchestrator.ts",
    data: {
      total: activeJobs.length,
      succeeded: fulfilledResults.length,
      failed: activeJobs.length - fulfilledResults.length,
    },
  });

  // ── PHASE 2: BULK FOUNDATIONAL WORK SELECTION ───────────────────────────
  const selectionInput = fulfilledResults
    .filter((r) => r.candidates.length > 0)
    .map((r) => ({
      title: r.subBox.title,
      boxType: r.boxType,
      description: r.boxDescription,
      candidates: r.candidates.map((c) => ({
        title: c.title,
        authors: c.authors,
        year: c.year,
        openAlexId: c.openAlexId,
        doi: c.doi,
        publisher: c.publisher,
      })),
    }));

  let bulkSelections: {
    subBoxTitle: string;
    selectedIndex: number;
    reasoning: string;
  }[] = [];

  if (selectionInput.length > 0) {
    logger.info("literature_bulk_foundational_selection_start", {
      service: "literature",
      filePath: "onboarding/literature-review/_services/batch-orchestrator.ts",
      data: { activeSubBoxCount: selectionInput.length },
    });

    try {
      const bulkResult = await selectFoundationalWorksBulk(
        selectionInput,
        logger,
      );
      bulkSelections = bulkResult.selections;

      logger.info("literature_bulk_foundational_selection_success", {
        service: "literature",
        filePath:
          "onboarding/literature-review/_services/batch-orchestrator.ts",
        data: { selectedCount: bulkSelections.length },
      });
    } catch (err) {
      logger.error("literature_bulk_foundational_selection_failed", {
        service: "literature",
        filePath:
          "onboarding/literature-review/_services/batch-orchestrator.ts",
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // ── PHASE 3: FINAL ASSIGNMENT, BULK SANITIZATION, AND PROGRESSIVE SAVE ────────────────────────
  const subBoxResultsToPersist: {
    subBoxTitle: string;
    thesisBoxId: number;
    articles: JuryArticle[];
    foundationalArticle: JuryArticle | null;
    top3Related: JuryArticle[];
  }[] = [];

  for (const r of fulfilledResults) {
    if (checkCancelled?.()) break;

    const subBoxArticles: JuryArticle[] = [];
    let foundationalArticle: JuryArticle | null = null;
    let topCluster: Cluster | null = null;

    const activeCandidates = r.candidates.filter(
      (c) => !assignedTitles.has(normalizeCleanTitle(c.title)),
    );

    if (activeCandidates.length > 0) {
      let chosenCandidate: (typeof activeCandidates)[number] | null = null;

      const matchedSelection = bulkSelections.find(
        (s) => s.subBoxTitle === r.subBox.title,
      );

      if (matchedSelection && matchedSelection.selectedIndex >= 0) {
        const fullSelectedCandidate =
          r.candidates[matchedSelection.selectedIndex];
        if (
          fullSelectedCandidate &&
          !assignedTitles.has(normalizeCleanTitle(fullSelectedCandidate.title))
        ) {
          chosenCandidate = fullSelectedCandidate;
        }
      }

      if (!chosenCandidate) {
        chosenCandidate = activeCandidates[0];
      }

      if (chosenCandidate) {
        foundationalArticle = {
          title: chosenCandidate.title,
          comparisonNote: null,
          badge: null,
          url: chosenCandidate.openAlexId,
          doi: chosenCandidate.doi,
          publisher: chosenCandidate.publisher,
          publicationYear: chosenCandidate.year,
          authors: chosenCandidate.authors.split(", ").map((a) => a.trim()),
          isFoundational: true,
          relevanceScore: 100,
        };
        assignedTitles.add(normalizeCleanTitle(chosenCandidate.title));
        topCluster = chosenCandidate.cluster;
      }
    }

    const queueItem: QueueItem = {
      subBoxTitle: r.subBox.title,
      boxType: r.boxType,
      boxDescription: r.boxDescription,
      candidates: r.candidates,
      activeWorks: r.activeWorks,
      rawPapers: r.rawPapers,
    };

    const top3Related = selectRelatedArticles(
      queueItem,
      topCluster,
      assignedTitles,
      foundationalArticle?.title,
    );

    for (const art of top3Related) {
      assignedTitles.add(normalizeCleanTitle(art.title));
    }

    if (foundationalArticle) {
      subBoxArticles.push(foundationalArticle);
    }
    subBoxArticles.push(...top3Related);

    // Programmatic Author Healing for any selected article with empty authors
    for (const art of subBoxArticles) {
      if (art.authors.length === 0 && !checkCancelled?.()) {
        try {
          const healed = await healAuthorsByTitle(art.title);
          if (healed && healed.length > 0) {
            art.authors = healed;
          }
        } catch (err) {
          logger.error("literature_author_healing_failed", {
            service: "literature",
            filePath:
              "onboarding/literature-review/_services/batch-orchestrator.ts",
            data: { title: art.title },
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      }
    }

    subBoxResultsToPersist.push({
      subBoxTitle: r.subBox.title,
      thesisBoxId: r.thesisBoxId,
      articles: subBoxArticles,
      foundationalArticle,
      top3Related,
    });
  }

  // Bulk sanitization of all selected articles in a single LLM call
  const allArticlesToSanitize: JuryArticle[] = [];
  for (const item of subBoxResultsToPersist) {
    allArticlesToSanitize.push(...item.articles);
  }

  if (allArticlesToSanitize.length > 0 && !checkCancelled?.()) {
    try {
      logger.info("literature_bulk_sanitization_start", {
        service: "literature",
        filePath:
          "onboarding/literature-review/_services/batch-orchestrator.ts",
        data: { count: allArticlesToSanitize.length },
      });

      const sanitized = await sanitizeAcademicDataBulk(
        allArticlesToSanitize.map((a) => ({
          title: a.title,
          author: a.authors.join(", "),
        })),
        logger,
      );

      for (let k = 0; k < allArticlesToSanitize.length; k++) {
        if (sanitized[k]) {
          allArticlesToSanitize[k].title = sanitized[k].title;
          allArticlesToSanitize[k].authors = sanitized[k].author
            .split(", ")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }

      logger.info("literature_bulk_sanitization_success", {
        service: "literature",
        filePath:
          "onboarding/literature-review/_services/batch-orchestrator.ts",
      });
    } catch (err) {
      logger.error("literature_bulk_sanitization_failed", {
        service: "literature",
        filePath:
          "onboarding/literature-review/_services/batch-orchestrator.ts",
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // Progressive save loops with already-sanitized articles
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
          service: "literature",
          filePath:
            "onboarding/literature-review/_services/batch-orchestrator.ts",
          data: { subBoxTitle: item.subBoxTitle },
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }
  }

  return { poolEntries, archivalBoxTitles };
}
