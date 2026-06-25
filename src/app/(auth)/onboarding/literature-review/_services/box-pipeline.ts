/**
 * Box pipeline — shared business logic used by both single-box and batch-box
 * literature review paths.
 *
 * Contains:
 * - `isArchivalBox` — detects boxes that bypass external APIs
 * - `distributeFixedPool` — rules-based 5+10 fixed pool distribution
 * - `resolveBoxFoundationalWorks` — Crossref foundational lookups for one box
 * - `runBoxPipeline` — AI review + distribution for a single box
 */

import { Logger } from "@/lib/logger";
import type { SubBoxInput, ValidatedPaper } from "./literature-review-papers";
import type { JuryArticle } from "@/lib/types";
import { runAcademicReviewStage } from "./ai-processor";
import { resolveFoundationalWorks } from "./foundational-resolver";
import { formatAcademicTitle } from "@/lib/utils/academic-formatter";

// ============================================================================
// Constants: Fixed pool sizes for rules-based 5+10 distribution
// ============================================================================

const STARTER_PACK_SIZE = 5;
const RESERVED_POOL_SIZE = 10;

// ============================================================================
// isArchivalBox — detects boxes that should bypass external APIs
// ============================================================================

export function isArchivalBox(subBox: SubBoxInput): boolean {
  if (subBox.boxType === "PRIMARY_MATERIAL") return true;
  if (!subBox.foundationalQueries || subBox.foundationalQueries.length === 0) {
    return false;
  }
  const first = subBox.foundationalQueries[0];
  return (
    first.author === "Primary Source Repository" || first.publicationYear === 0
  );
}

// ============================================================================
// resolveBoxFoundationalWorks — Crossref foundational lookups for one box
// ============================================================================

export async function resolveBoxFoundationalWorks(
  box: SubBoxInput,
  logger: Logger,
): Promise<JuryArticle[]> {
  if (!box.foundationalQueries || box.foundationalQueries.length === 0) {
    return [];
  }

  logger.info("literature_foundational_start", {
    service: "literature",
    filePath: "onboarding/literature-review/_services/box-pipeline.ts",
    data: {
      queryCount: box.foundationalQueries.length,
      subBoxTitle: box.title,
      context: `Kutu: ${box.title}`,
    },
  });

  const foundationalStart = performance.now();
  const resolved = await resolveFoundationalWorks(
    box.foundationalQueries,
    logger,
  );

  const articles: JuryArticle[] = resolved.map((fw) => ({
    title: formatAcademicTitle(fw.title),
    abstract: "",
    url: fw.id,
    doi: "",
    publisher: fw.publisher ?? "",
    publicationYear: fw.publicationYear,
    authors: fw.authors,
    isFoundational: true,
    relevanceScore: 100,
  }));

  logger.info("literature_foundational_done", {
    service: "literature",
    durationMs: performance.now() - foundationalStart,
    filePath: "onboarding/literature-review/_services/box-pipeline.ts",
    status: "SUCCESS",
    data: { resultCount: articles.length, context: `Kutu: ${box.title}` },
  });

  return articles;
}

// ============================================================================
// distributeFixedPool — rules-based 5+10 distribution
// ============================================================================

/**
 * Distributes foundational and AI-filtered semantic articles into a fixed-size
 * starter pack (5) and reserved pool (10) using a pure rules-based algorithm:
 *
 * 1. All isFoundational articles are given priority for the starter pack.
 * 2. Remaining starter pack slots are filled by the highest relevanceScore
 *    from non-foundational articles.
 * 3. The reserved pool gets the next 10 highest-scoring remaining articles.
 *
 * Articles from the semantic list that duplicate foundational titles are
 * silently removed before distribution.
 */
export function distributeFixedPool(
  foundationalArticles: JuryArticle[],
  semanticArticles: JuryArticle[],
): { starterPack: JuryArticle[]; reservedPool: JuryArticle[] } {
  const foundationalTitles = new Set(
    foundationalArticles
      .map((a) => a.title?.toLowerCase().trim())
      .filter(Boolean),
  );

  const dedupedSemantic = semanticArticles.filter(
    (a) => !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
  );

  const allArticles = [...foundationalArticles, ...dedupedSemantic].sort(
    (a, b) => {
      if (a.isFoundational !== b.isFoundational) {
        return a.isFoundational ? -1 : 1;
      }
      return b.relevanceScore - a.relevanceScore;
    },
  );

  return {
    starterPack: allArticles.slice(0, STARTER_PACK_SIZE),
    reservedPool: allArticles.slice(
      STARTER_PACK_SIZE,
      STARTER_PACK_SIZE + RESERVED_POOL_SIZE,
    ),
  };
}

// ============================================================================
// runBoxPipeline — AI review + distribution for a single box
// ============================================================================

/**
 * Runs a single box through the post-search pipeline:
 * 1. Fills abstract placeholders for missing abstracts
 * 2. Calls AI academic review (runAcademicReviewStage)
 * 3. Distributes articles into 5+10 fixed pool
 *
 * @param box - The sub-box metadata
 * @param candidates - Validated papers from OpenAlex (already deduplicated)
 * @param foundationalArticles - Pre-resolved foundational works
 * @param thesisCtx - Thesis context for AI prompts
 * @param logger - Logger instance
 * @returns The distributed starter pack and reserved pool
 */
export async function runBoxPipeline(
  box: SubBoxInput,
  candidates: ValidatedPaper[],
  foundationalArticles: JuryArticle[],
  thesisCtx: {
    studyTitle: string;
    researchQuestion: string;
    theoreticalFramework: string;
    researchScope: string;
  },
  logger: Logger,
): Promise<{ starterPack: JuryArticle[]; reservedPool: JuryArticle[] }> {
  if (candidates.length === 0 && foundationalArticles.length === 0) {
    return { starterPack: [], reservedPool: [] };
  }

  if (candidates.length === 0) {
    return distributeFixedPool(foundationalArticles, []);
  }

  // Fill abstract placeholders for AI review
  for (const p of candidates) {
    if (!p.abstract || !p.abstract.trim()) {
      p.abstract = "Özet verisi bulunamadı, başlık üzerinden değerlendirin";
    }
  }

  const reviewStart = performance.now();
  const reviewResult = await runAcademicReviewStage(
    box,
    candidates,
    logger,
    thesisCtx,
  );

  logger.info("literature_academic_review_done", {
    service: "literature",
    durationMs: performance.now() - reviewStart,
    filePath: "onboarding/literature-review/_services/box-pipeline.ts",
    status: "SUCCESS",
    data: {
      count: candidates.length,
      resultCount:
        reviewResult.starterPack.length + reviewResult.reservedPool.length,
      starterPackCount: reviewResult.starterPack.length,
      reservedPoolCount: reviewResult.reservedPool.length,
      context: `Kutu: ${box.title}`,
    },
  });

  return distributeFixedPool(foundationalArticles, reviewResult.starterPack);
}
