/**
 * Batch orchestrator — coordinates the full multi-box literature review pipeline.
 *
 * Orchestrates:
 * 1. Sequential search across all boxes (foundational + OpenAlex semantic)
 * 2. Global cross-box deduplication
 * 3. Per-box AI academic review + hybrid 3-tier distribution
 * 4. Pool entry assembly
 */

import { Logger } from "@/lib/logger";
import type {
  SubBoxInput,
  ValidatedPaper,
  RawPaper,
} from "./literature-review-papers";
import type { JuryArticle, LiteraturePoolEntry } from "@/lib/types";
import { collectOpenAlexResults } from "./openalex-collector";
import { mergePapers } from "./literature-review-papers";
import {
  isArchivalBox,
  resolveBoxFoundationalWorks,
  runBoxPipeline,
} from "./box-pipeline";
import { deduplicateCandidatesGlobally } from "./ai-processor";

// ============================================================================
// Public interface
// ============================================================================

export interface BatchOrchestrationResult {
  poolEntries: LiteraturePoolEntry[];
  archivalBoxTitles: string[];
}

// ============================================================================
// Orchestrator
// ============================================================================

/**
 * Runs the full batch literature review pipeline over all sub-boxes.
 *
 * Phase 1 — Sequential search (archival detection → foundational lookup →
 *            OpenAlex semantic search with throttle)
 * Phase 2 — Global cross-box deduplication
 * Phase 3 — Per-box AI academic review + hybrid 3-tier distribution
 *           (foundational → YÖK theses → semantic)
 *
 * @param boxes - All sub-boxes to process
 * @param thesisCtx - Thesis context used in AI prompts
 * @param logger - Logger instance
 * @param cachedPapers - Optional pre-cached OpenAlex results
 * @param thesisArticlesMap - Optional per-box YÖK thesis articles from risk phase
 * @returns Pool entries for all boxes plus archival box titles
 */
export async function orchestrateBatchProcess(
  boxes: SubBoxInput[],
  thesisCtx: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    researchScope: string;
  },
  logger: Logger,
  cachedPapers?: Record<string, RawPaper[]>,
  thesisArticlesMap?: Map<string, JuryArticle[]>,
): Promise<BatchOrchestrationResult> {
  // ------------------------------------------------------------------
  // Phase 1: Sequential search across all boxes
  // ------------------------------------------------------------------
  const boxSearchResults = new Map<string, ValidatedPaper[]>();
  const archivalBoxTitles: string[] = [];
  const foundationalLookups = new Map<string, JuryArticle[]>();

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];

    logger.info("literature_batch_search_start", {
      service: "literature",
      filePath: "onboarding/literature-review/_services/batch-orchestrator.ts",
      data: {
        boxIndex: i,
        boxTitle: box.title,
        boxType: box.boxType ?? "bilinmiyor",
      },
    });

    // Archival bypass
    if (isArchivalBox(box)) {
      archivalBoxTitles.push(box.title);
      boxSearchResults.set(box.title, []);
      foundationalLookups.set(box.title, []);

      logger.info("literature_archival_bypass", {
        service: "literature",
        filePath:
          "onboarding/literature-review/_services/batch-orchestrator.ts",
        data: {
          subBoxTitle: box.title,
          boxType: box.boxType ?? "bilinmiyor",
          context: `Kutu: ${box.title}`,
        },
      });
      continue;
    }

    // Skip boxes without semantic queries
    if (!box.semanticSearchQueries || box.semanticSearchQueries.length === 0) {
      boxSearchResults.set(box.title, []);
      foundationalLookups.set(box.title, []);
      continue;
    }

    // Foundational works resolution
    const foundationalArticles = await resolveBoxFoundationalWorks(box, logger);
    foundationalLookups.set(box.title, foundationalArticles);

    // OpenAlex semantic search with throttle (bypass if cached data exists)
    const boxCache = cachedPapers?.[box.title];
    const merged =
      boxCache && boxCache.length > 0
        ? mergePapers(boxCache)
        : await collectOpenAlexResults(box.semanticSearchQueries, logger);
    boxSearchResults.set(box.title, merged);

    logger.info("literature_batch_search_done", {
      service: "literature",
      filePath: "onboarding/literature-review/_services/batch-orchestrator.ts",
      data: {
        boxTitle: box.title,
        resultCount: merged.length,
      },
    });
  }

  // ------------------------------------------------------------------
  // Phase 2: Global cross-box deduplication
  // ------------------------------------------------------------------
  const dedupStart = performance.now();
  const dedupedResults = deduplicateCandidatesGlobally(
    boxSearchResults,
    logger,
  );

  logger.info("literature_global_dedup_done", {
    service: "literature",
    durationMs: performance.now() - dedupStart,
    filePath: "onboarding/literature-review/_services/batch-orchestrator.ts",
    data: {
      totalBefore: [...boxSearchResults.values()].reduce(
        (s, a) => s + a.length,
        0,
      ),
      totalAfter: [...dedupedResults.values()].reduce(
        (s, a) => s + a.length,
        0,
      ),
    },
  });

  // ------------------------------------------------------------------
  // Phase 3: Per-box AI review + fixed-pool distribution
  // ------------------------------------------------------------------
  const poolPromises = boxes.map(async (box) => {
    if (archivalBoxTitles.includes(box.title)) {
      return {
        subBoxTitle: box.title,
        starterPack: foundationalLookups.get(box.title) ?? [],
        reservedPool: [] as JuryArticle[],
      };
    }

    const candidates = dedupedResults.get(box.title);
    if (!candidates || candidates.length === 0) {
      return {
        subBoxTitle: box.title,
        starterPack: foundationalLookups.get(box.title) ?? [],
        reservedPool: [] as JuryArticle[],
      };
    }

    const { starterPack, reservedPool } = await runBoxPipeline(
      box,
      candidates,
      foundationalLookups.get(box.title) ?? [],
      thesisArticlesMap?.get(box.title) ?? [],
      thesisCtx,
      logger,
    );

    return {
      subBoxTitle: box.title,
      starterPack,
      reservedPool,
    };
  });

  const poolEntries = await Promise.all(poolPromises);

  logger.info("literature_batch_process_done", {
    service: "literature",
    filePath: "onboarding/literature-review/_services/batch-orchestrator.ts",
    data: {
      boxCount: boxes.length,
      totalStarterPack: poolEntries.reduce(
        (s, e) => s + e.starterPack.length,
        0,
      ),
      totalReservedPool: poolEntries.reduce(
        (s, e) => s + e.reservedPool.length,
        0,
      ),
    },
  });

  return { poolEntries, archivalBoxTitles };
}
