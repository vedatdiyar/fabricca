/**
 * Batch orchestrator — coordinates the full multi-box literature review pipeline.
 *
 * Orchestrates:
 * 1. Service-based isolated queues for API rate-limit compliance:
 *    - OpenAlex: globally serialised with 1000ms gap (openalex/client.ts)
 *    - Crossref enrichment: concurrency-limited to 3 at a time
 *    - Foundational resolution: concurrency=2 pool across all sub-boxes
 * 2. Global cross-box deduplication
 * 3. Per-sub-box distribution (1 foundational + 3 semantic per sub-box)
 * 4. Pool entry assembly
 */

import { Logger } from "@/lib/logger";
import { createConcurrencyLimiter } from "@/lib/rate-limiter";
import type {
  SubBoxInput,
  ValidatedPaper,
  RawPaper,
} from "./literature-review-papers";
import type { JuryArticle, LiteraturePoolEntry } from "@/lib/types";
import { mergePapers } from "./literature-review-papers";
import { isArchivalBox } from "./box-pipeline";
import { resolveFoundationalWorks } from "./foundational-resolver";
import { validateWithCrossRef } from "./crossref/validator";

// ============================================================================
// Public interface
// ============================================================================

export interface BatchOrchestrationResult {
  poolEntries: LiteraturePoolEntry[];
  archivalBoxTitles: string[];
}

// ============================================================================
// Service-based isolated queues
// ============================================================================

/**
 * Crossref enrichment limiter — max 3 concurrent requests.
 * (The Crossref API allows bursty traffic; this cap prevents overwhelming
 * both the network layer and the upstream service.)
 */
const crossrefLimiter = createConcurrencyLimiter(3);

/**
 * Foundational resolution limiter — max 2 concurrent resolveFoundationalWorks
 * calls. Each call already has internal BATCH_SIZE=2 parallelism, so this
 * gives up to 4 concurrent Crossref DOI lookups overall.
 */
const foundationalLimiter = createConcurrencyLimiter(2);

// ============================================================================
// Helpers
// ============================================================================

const MAX_SEMANTIC_PER_SUB_BOX = 3;

function toSemanticArticle(candidate: ValidatedPaper): JuryArticle {
  return {
    title: candidate.title,
    abstract: candidate.abstract ?? "",
    url: candidate.url ?? "",
    doi: candidate.doi,
    publisher: candidate.publisher ?? "",
    publicationYear: candidate.year ?? 0,
    authors: candidate.authors,
    isFoundational: false,
    relevanceScore: Math.round(candidate.relevanceScore * 100),
    subBoxId: candidate.subBoxId,
  };
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

function deduplicateCandidatesGlobally(
  boxCandidates: Map<string, ValidatedPaper[]>,
  logger?: Logger,
): Map<string, ValidatedPaper[]> {
  const result = new Map<string, ValidatedPaper[]>();

  for (const [title, candidates] of boxCandidates) {
    result.set(
      title,
      candidates.map((c) => ({ ...c })),
    );
  }

  // Phase 1: Build a global index keyed by dedup key
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

  // Phase 2: Hard dedup — keep only the highest-scoring occurrence
  const eliminatedPerBox = new Map<string, DedupEliminatedEntry[]>();

  for (const [, occurrences] of globalIndex) {
    if (occurrences.length < 2) continue;

    occurrences.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore)
        return b.relevanceScore - a.relevanceScore;
      return a.boxTitle.localeCompare(b.boxTitle);
    });

    for (let k = 1; k < occurrences.length; k++) {
      const loser = occurrences[k];
      const boxCandidates = result.get(loser.boxTitle);
      if (!boxCandidates) continue;

      const candidate = boxCandidates[loser.index];
      if (!candidate) continue;

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

  // Phase 3: Compact nulls from each box
  for (const [boxTitle, candidates] of result) {
    const compacted = candidates.filter((c): c is ValidatedPaper => c !== null);
    result.set(boxTitle, compacted);
  }

  // Phase 4: Soft restore
  for (const [boxTitle, candidates] of result) {
    if (candidates.length >= GLOBAL_DEDUP_MIN_SAFE_COUNT) continue;

    const eliminated = eliminatedPerBox.get(boxTitle);
    if (!eliminated || eliminated.length === 0) continue;

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
          context: `${toRestore.length} aday ${boxTitle} kutusuna geri iade edildi`,
        },
      });
    }
  }

  return result;
}

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
 * Resolves all foundational queries from every sub-box of a single box using
 * the foundational concurrency limiter (max 2 in-flight).
 *
 * Returns a record keyed by sub-box index.
 */
async function resolveBoxFoundationals(
  subBoxes: SubBoxInput["subBoxes"],
  logger: Logger,
): Promise<{
  allFoundationals: JuryArticle[];
  bySubBox: Map<number, JuryArticle[]>;
}> {
  const allFoundationals: JuryArticle[] = [];
  const bySubBox = new Map<number, JuryArticle[]>();

  const tasks = subBoxes
    .map((sub, si) => ({ sub, si }))
    .filter(({ sub }) => sub.foundationalQueries?.length > 0);

  await Promise.all(
    tasks.map(({ sub, si }) =>
      foundationalLimiter.exec(async () => {
        const resolved = await resolveFoundationalWorks(
          sub.foundationalQueries,
          logger,
        );
        const articles: JuryArticle[] = resolved.map((fw) => ({
          title: fw.title,
          abstract: "",
          url: fw.id,
          doi: null as string | null,
          publisher: fw.publisher ?? "",
          publicationYear: fw.publicationYear,
          authors: fw.authors,
          isFoundational: true,
          relevanceScore: 100,
          subBoxId: String(si),
        }));
        allFoundationals.push(...articles);
        bySubBox.set(si, articles);
      }),
    ),
  );

  return { allFoundationals, bySubBox };
}

export async function orchestrateBatchProcess(
  boxes: SubBoxInput[],
  logger: Logger,
  cachedPapers?: Record<string, RawPaper[]>,
  thesisArticlesMap?: Map<string, JuryArticle[]>,
): Promise<BatchOrchestrationResult> {
  // ------------------------------------------------------------------
  // Phase 1: Service-based parallel search across all sub-boxes
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

    // Archival bypass — these boxes skip external API calls
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

    if (!box.subBoxes || box.subBoxes.length === 0) {
      boxSearchResults.set(box.title, []);
      foundationalLookups.set(box.title, []);
      continue;
    }

    // Check for cached papers (pre-fetched during box confirmation)
    const boxCache = cachedPapers?.[box.title];
    const allPapers: RawPaper[] = [];
    const { allFoundationals } = await resolveBoxFoundationals(
      box.subBoxes,
      logger,
    );

    if (boxCache && boxCache.length > 0) {
      // Cached papers already have subBoxId set during prefetch (actions.ts Step 4)
      allPapers.push(...boxCache);
    } else {
      logger.warn("literature_no_cache_for_box", {
        service: "literature",
        filePath:
          "onboarding/literature-review/_services/batch-orchestrator.ts",
        data: {
          boxTitle: box.title,
          context:
            "OA verisi ön-çekme aşamasında (actions.ts Step 4) alınmalıdır. Bu kutu için cache bulunamadı, boş sonuç dönülüyor.",
        },
      });
    }

    const merged = mergePapers(allPapers);

    // Crossref enrichment: concurrency-limited to max 3 in-flight.
    // Each validateWithCrossRef call already has its own 3-retry strategy
    // with exponential backoff + jitter.
    const enriched = await Promise.all(
      merged.map((p) =>
        crossrefLimiter.exec(() => validateWithCrossRef(p, logger)),
      ),
    );

    boxSearchResults.set(box.title, enriched);
    foundationalLookups.set(box.title, allFoundationals);

    logger.info("literature_batch_search_done", {
      service: "literature",
      filePath: "onboarding/literature-review/_services/batch-orchestrator.ts",
      data: {
        boxTitle: box.title,
        resultCount: merged.length,
        foundationalCount: allFoundationals.length,
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
  // Phase 3: Per-sub-box distribution (1 foundational + 3 semantic)
  // ------------------------------------------------------------------
  const poolPromises = boxes.map(async (box) => {
    // Archival boxes: keep existing behavior (just foundationals or theses)
    if (archivalBoxTitles.includes(box.title)) {
      return {
        subBoxTitle: box.title,
        articles:
          box.boxType === "RELATED_THESES"
            ? (thesisArticlesMap?.get(box.title) ?? [])
            : (foundationalLookups.get(box.title) ?? []),
      } satisfies LiteraturePoolEntry;
    }

    const candidates = dedupedResults.get(box.title);
    const foundationals = foundationalLookups.get(box.title) ?? [];

    if (!candidates || candidates.length === 0) {
      return {
        subBoxTitle: box.title,
        articles: foundationals,
      } satisfies LiteraturePoolEntry;
    }

    logger.info("literature_distribution_start", {
      service: "literature",
      filePath: "onboarding/literature-review/_services/batch-orchestrator.ts",
      data: {
        count: candidates.length,
        foundationalCount: foundationals.length,
        subBoxCount: box.subBoxes?.length ?? 0,
        context: `Kutu: ${box.title}`,
      },
    });

    const allArticles: JuryArticle[] = [];

    // Build a set of normalized titles from all foundational works.
    // If a semantic candidate has the same title as a foundational work,
    // it is excluded — preventing the same paper from appearing twice.
    const foundationalTitles = new Set<string>();
    for (const f of foundationals) {
      const key = f.title.toLowerCase().replace(/\s+/g, " ").trim();
      if (key.length > 5) foundationalTitles.add(key);
    }

    // First pass: all foundational works first, then semantic articles.
    for (let si = 0; si < (box.subBoxes?.length ?? 0); si++) {
      const subFoundational = foundationals.filter(
        (f) => f.subBoxId === String(si),
      );
      const topFoundational = subFoundational
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 1);
      allArticles.push(...topFoundational);
    }

    // Second pass: all semantic articles (excluding duplicates of foundationals)
    for (let si = 0; si < (box.subBoxes?.length ?? 0); si++) {
      const subSemantic = candidates
        .filter((c) => c.subBoxId === String(si))
        .filter((c) => {
          const key = (c.title || "").toLowerCase().replace(/\s+/g, " ").trim();
          return !foundationalTitles.has(key);
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, MAX_SEMANTIC_PER_SUB_BOX)
        .map(toSemanticArticle);
      allArticles.push(...subSemantic);
    }

    return {
      subBoxTitle: box.title,
      articles: allArticles,
    } satisfies LiteraturePoolEntry;
  });

  const poolEntries = await Promise.all(poolPromises);

  logger.info("literature_batch_process_done", {
    service: "literature",
    filePath: "onboarding/literature-review/_services/batch-orchestrator.ts",
    data: {
      boxCount: boxes.length,
      totalArticles: poolEntries.reduce((s, e) => s + e.articles.length, 0),
    },
  });

  return { poolEntries, archivalBoxTitles };
}
