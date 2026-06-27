/**
 * Batch orchestrator — coordinates the full multi-box literature review pipeline.
 *
 * Orchestrates:
 * 1. Sequential search across all boxes (foundational + OpenAlex semantic)
 * 2. Global cross-box deduplication
 * 3. Per-box hybrid 3-tier distribution
 * 4. Pool entry assembly
 */

import { Logger } from "@/lib/logger";
import type {
  SubBoxInput,
  ValidatedPaper,
  RawPaper,
} from "./literature-review-papers";
import type { JuryArticle, LiteraturePoolEntry } from "@/lib/types";
import { searchOpenAlex } from "./openalex/client";
import { mergePapers } from "./literature-review-papers";
import {
  isArchivalBox,
  resolveBoxFoundationalWorks,
  runBoxPipeline,
} from "./box-pipeline";

// ============================================================================
// Public interface
// ============================================================================

export interface BatchOrchestrationResult {
  poolEntries: LiteraturePoolEntry[];
  archivalBoxTitles: string[];
}

// ============================================================================
// Global Cross-Box Candidate Deduplication
// ============================================================================

/** Minimum safe candidate count per box after global dedup. */
const GLOBAL_DEDUP_MIN_SAFE_COUNT = 1;

interface DedupEliminatedEntry {
  boxTitle: string;
  candidate: ValidatedPaper;
  relevanceScore: number;
}

/**
 * Deduplicates raw candidates across all boxes globally.
 *
 * If the same article (matching DOI or OpenAlex ID) appears in multiple boxes,
 * it is retained only in the box where it achieved the highest relevanceScore.
 * After hard dedup, if any box falls below the safe threshold
 * (`GLOBAL_DEDUP_MIN_SAFE_COUNT`), the highest-scoring eliminated candidates
 * are restored to that box as a soft-dedup safeguard.
 *
 * @param boxCandidates - Map of box title → array of raw candidates
 * @returns A new map with the same keys but deduplicated candidate arrays
 */
function deduplicateCandidatesGlobally(
  boxCandidates: Map<string, ValidatedPaper[]>,
  logger?: Logger,
): Map<string, ValidatedPaper[]> {
  const result = new Map<string, ValidatedPaper[]>();

  // Clone the input so we never mutate the caller's data
  for (const [title, candidates] of boxCandidates) {
    result.set(
      title,
      candidates.map((c) => ({ ...c })),
    );
  }

  // ------------------------------------------------------------------
  // Phase 1: Build a global index keyed by dedup key
  // ------------------------------------------------------------------
  // dedupKey → { boxTitle, relevanceScore, indexInBox }[]
  const globalIndex = new Map<
    string,
    { boxTitle: string; relevanceScore: number; index: number }[]
  >();

  for (const [boxTitle, candidates] of result) {
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const dedupKey = resolveDedupKey(c);
      if (!dedupKey) continue;

      let bucket = globalIndex.get(dedupKey);
      if (!bucket) {
        bucket = [];
        globalIndex.set(dedupKey, bucket);
      }
      bucket.push({
        boxTitle,
        relevanceScore: c.relevanceScore,
        index: i,
      });
    }
  }

  // ------------------------------------------------------------------
  // Phase 2: Hard dedup — keep only the highest-scoring occurrence
  // ------------------------------------------------------------------
  // Track eliminated candidates per box for soft-restore
  const eliminatedPerBox = new Map<string, DedupEliminatedEntry[]>();

  for (const [, occurrences] of globalIndex) {
    if (occurrences.length < 2) continue; // not a duplicate

    // Sort by relevanceScore descending, then by box title alphabetically
    // for deterministic tie-breaking
    occurrences.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore)
        return b.relevanceScore - a.relevanceScore;
      return a.boxTitle.localeCompare(b.boxTitle);
    });

    // Keep the winner (occurrences[0]), eliminate duplicates starting at index 1

    for (let k = 1; k < occurrences.length; k++) {
      const loser = occurrences[k];
      const boxCandidates = result.get(loser.boxTitle);
      if (!boxCandidates) continue;

      const candidate = boxCandidates[loser.index];
      if (!candidate) continue;

      // Mark as eliminated (null) — we'll compact later
      boxCandidates[loser.index] = null as unknown as ValidatedPaper;

      let elimBucket = eliminatedPerBox.get(loser.boxTitle);
      if (!elimBucket) {
        elimBucket = [];
        eliminatedPerBox.set(loser.boxTitle, elimBucket);
      }
      elimBucket.push({
        boxTitle: loser.boxTitle,
        candidate,
        relevanceScore: candidate.relevanceScore,
      });
    }
  }

  // ------------------------------------------------------------------
  // Phase 3: Compact nulls from each box
  // ------------------------------------------------------------------
  for (const [boxTitle, candidates] of result) {
    const compacted = candidates.filter((c): c is ValidatedPaper => c !== null);
    result.set(boxTitle, compacted);
  }

  // ------------------------------------------------------------------
  // Phase 4: Soft restore — if any box is starving, bring back
  //           the highest-scoring eliminated candidates
  // ------------------------------------------------------------------
  for (const [boxTitle, candidates] of result) {
    if (candidates.length >= GLOBAL_DEDUP_MIN_SAFE_COUNT) continue;

    const eliminated = eliminatedPerBox.get(boxTitle);
    if (!eliminated || eliminated.length === 0) continue;

    // Sort eliminated by relevanceScore descending
    eliminated.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const needed = GLOBAL_DEDUP_MIN_SAFE_COUNT - candidates.length;
    const toRestore = eliminated.slice(0, needed);

    for (const entry of toRestore) {
      candidates.push({ ...entry.candidate });
    }

    if (logger && toRestore.length > 0) {
      logger.warn("literature_soft_dedup_restore", {
        service: "literature",
        filePath:
          "onboarding/literature-review/_services/batch-orchestrator.ts",
        data: {
          boxTitle,
          restoredCount: toRestore.length,
          candidateTitles: toRestore.map((e) => e.candidate.title),
          context: `Soft-dedup restore: ${toRestore.length} aday ${boxTitle} kutusuna geri iade edildi`,
        },
      });
    }
  }

  return result;
}

/**
 * Resolves a stable deduplication key for a candidate.
 * Priority: DOI > OpenAlex ID > title (first 100 chars lowercase).
 * Returns null if no meaningful key can be derived.
 */
function resolveDedupKey(candidate: ValidatedPaper): string | null {
  if (candidate.doi) {
    const cleaned = candidate.doi.trim().toLowerCase();
    if (/^10\.\d{4,}/.test(cleaned)) return "doi:" + cleaned;
  }
  if (candidate.openAlexId) {
    return "oa:" + candidate.openAlexId.trim();
  }
  if (candidate.title) {
    const titleKey = candidate.title
      .toLowerCase()
      .replace(/\s+/g, " ")
      .slice(0, 100)
      .trim();
    if (titleKey.length > 10) return "title:" + titleKey;
  }
  return null;
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
 * Phase 3 — Per-box 1+1 distribution (1 foundational → 1 semantic)
 *
 * @param boxes - All sub-boxes to process
 * @param logger - Logger instance
 * @param cachedPapers - Optional pre-cached OpenAlex results
 * @param thesisArticlesMap - Optional per-box YÖK thesis articles from risk phase
 * @returns Pool entries for all boxes plus archival box titles
 */
export async function orchestrateBatchProcess(
  boxes: SubBoxInput[],
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

    // Skip boxes without subBoxes
    if (!box.subBoxes || box.subBoxes.length === 0) {
      boxSearchResults.set(box.title, []);
      foundationalLookups.set(box.title, []);
      continue;
    }

    // Foundational works resolution
    const foundationalArticles = await resolveBoxFoundationalWorks(box, logger);
    foundationalLookups.set(box.title, foundationalArticles);

    const boxCache = cachedPapers?.[box.title];
    let merged: ValidatedPaper[];

    if (boxCache && boxCache.length > 0) {
      merged = mergePapers(boxCache);
    } else {
      const allRawPapers: RawPaper[] = [];
      for (let qi = 0; qi < (box.subBoxes?.length ?? 0); qi++) {
        const sub = box.subBoxes![qi];
        if (!sub.semanticQuery?.trim()) continue;

        try {
          const results = await searchOpenAlex(sub.semanticQuery);
          for (const rp of results) {
            rp.subBoxId = String(qi);
          }
          allRawPapers.push(...results);
        } catch {
          // Silently skip failed queries
        }

        // Throttle between sub-box queries
        if (qi < (box.subBoxes?.length ?? 0) - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1100));
        }
      }
      merged = mergePapers(allRawPapers);
    }
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
  // Phase 3: Per-box fixed-pool distribution
  // ------------------------------------------------------------------
  const poolPromises = boxes.map(async (box) => {
    if (archivalBoxTitles.includes(box.title)) {
      return {
        subBoxTitle: box.title,
        starterPack:
          box.boxType === "RELATED_THESES"
            ? (thesisArticlesMap?.get(box.title) ?? [])
            : (foundationalLookups.get(box.title) ?? []),
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
