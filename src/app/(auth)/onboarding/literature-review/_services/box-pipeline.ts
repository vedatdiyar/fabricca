/**
 * Box pipeline — shared business logic used by both single-box and batch-box
 * literature review paths.
 *
 * Contains:
 * - `isArchivalBox` — detects boxes that bypass external APIs
 * - `distributeFixedPool` — 1+1 per-subBox distribution (1 foundational →
 *   1 semantic)
 * - `resolveBoxFoundationalWorks` — Crossref foundational lookups for one box
 * - `runBoxPipeline` — distribution for a single box
 */

import { Logger } from "@/lib/logger";
import type { SubBoxInput, ValidatedPaper } from "./literature-review-papers";
import type { JuryArticle } from "@/lib/types";
import { resolveFoundationalWorks } from "./foundational-resolver";
import { formatAcademicTitle } from "@/lib/utils/academic-formatter";

// ============================================================================
// Constants: Pool limits for 1+1 core distribution
// ============================================================================

const RESERVED_SEMANTIC_MAX = 1;
const MAX_FOUNDATIONAL_IN_STARTER = 1;

// ============================================================================
// isArchivalBox — detects boxes that should bypass external APIs
// ============================================================================

export function isArchivalBox(subBox: SubBoxInput): boolean {
  if (subBox.boxType === "PRIMARY_MATERIAL") return true;
  if (subBox.boxType === "RELATED_THESES") return true;
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
    doi: null as string | null,
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
// distributeFixedPool — 1+1 core distribution (1 foundational + 1 semantic)
// ============================================================================

/**
 * Distributes foundational and semantic articles into a strict 1+1 core:
 *
 * 1. Foundational (isFoundational: true) — top 1 by relevanceScore → starterPack
 * 2. Semantic OpenAlex — top 1 by relevanceScore → reservedPool
 *    (semantic articles that duplicate a foundational title are silently removed)
 *
 * Thesis articles are not distributed under the 1+1 subBox contract.
 *
 * @param foundationalArticles - Crossref-resolved foundational works
 * @param thesisArticles - YÖK thesis articles (unused in 1+1 mode)
 * @param semanticArticles - AI-reviewed OpenAlex semantic search results
 * @returns Starter pack (top foundational) and reserved pool (top semantic)
 */
export function distributeFixedPool(
  foundationalArticles: JuryArticle[],
  _thesisArticles: JuryArticle[],
  semanticArticles: JuryArticle[],
): { starterPack: JuryArticle[]; reservedPool: JuryArticle[] } {
  // Pick top 1 foundational by relevanceScore
  const topFoundational = [...foundationalArticles]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, MAX_FOUNDATIONAL_IN_STARTER);

  // Build a dedup set from foundational titles
  const foundationalTitles = new Set(
    topFoundational.map((a) => a.title?.toLowerCase().trim()).filter(Boolean),
  );

  // Pick top 1 semantic, filtering out foundational duplicates
  const topSemantic = [...semanticArticles]
    .filter(
      (a) => !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
    )
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, RESERVED_SEMANTIC_MAX);

  return {
    starterPack: topFoundational,
    reservedPool: topSemantic,
  };
}

// ============================================================================
// runBoxPipeline — distribution for a single box
// ============================================================================

/**
 * Runs a single box through the post-search distribution pipeline:
 * Distributes articles into a 1+1 pool (1 foundational → 1 semantic).
 *
 * @param box - The sub-box metadata
 * @param candidates - Validated papers from OpenAlex (already deduplicated)
 * @param foundationalArticles - Pre-resolved foundational works
 * @param thesisArticles - YÖK thesis articles mapped via library_resources
 * @param logger - Logger instance
 * @returns The distributed starter pack and reserved pool (1 foundational + 1 semantic)
 */
export async function runBoxPipeline(
  box: SubBoxInput,
  candidates: ValidatedPaper[],
  foundationalArticles: JuryArticle[],
  thesisArticles: JuryArticle[],
  logger: Logger,
): Promise<{ starterPack: JuryArticle[]; reservedPool: JuryArticle[] }> {
  if (
    candidates.length === 0 &&
    foundationalArticles.length === 0 &&
    thesisArticles.length === 0
  ) {
    return { starterPack: [], reservedPool: [] };
  }

  if (candidates.length === 0) {
    return distributeFixedPool(foundationalArticles, thesisArticles, []);
  }

  logger.info("literature_distribution_start", {
    service: "literature",
    filePath: "onboarding/literature-review/_services/box-pipeline.ts",
    data: {
      count: candidates.length,
      foundationalCount: foundationalArticles.length,
      thesisCount: thesisArticles.length,
      context: `Kutu: ${box.title}`,
    },
  });

  const semanticArticles: JuryArticle[] = candidates.map((c) => ({
    title: c.title,
    abstract: c.abstract ?? "",
    url: c.url ?? "",
    doi: c.doi,
    publisher: c.publisher ?? "",
    publicationYear: c.year ?? 0,
    authors: c.authors,
    isFoundational: false,
    relevanceScore: Math.round(c.relevanceScore * 100),
    subBoxId: c.subBoxId,
  }));

  return distributeFixedPool(
    foundationalArticles,
    thesisArticles,
    semanticArticles,
  );
}
