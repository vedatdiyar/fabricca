/**
 * Box pipeline — shared business logic used by both single-box and batch-box
 * literature review paths.
 *
 * Contains:
 * - `isArchivalBox` — detects boxes that bypass external APIs
 * - `distributeFixedPool` — hybrid 3-tier 5+10 distribution (foundational →
 *   YÖK theses → semantic)
 * - `resolveBoxFoundationalWorks` — Crossref foundational lookups for one box
 * - `runBoxPipeline` — distribution for a single box
 */

import { Logger } from "@/lib/logger";
import type { SubBoxInput, ValidatedPaper } from "./literature-review-papers";
import type { JuryArticle } from "@/lib/types";
import { resolveFoundationalWorks } from "./foundational-resolver";
import { formatAcademicTitle } from "@/lib/utils/academic-formatter";

// ============================================================================
// Constants: Hybrid pool sizes for the 3-tier distribution
// ============================================================================

const STARTER_PACK_SIZE = 5;
const RESERVED_SEMANTIC_MAX = 10;
const MAX_FOUNDATIONAL_IN_STARTER = 3;

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
// distributeFixedPool — hybrid 3-tier 5+10 distribution
// ============================================================================

/**
 * Distributes foundational, YÖK thesis, and AI-filtered semantic articles into
 * a fixed-size starter pack (max 5) and a reserved pool using a strict 3-tier
 * hierarchical algorithm:
 *
 * 1. Foundational (isFoundational: true) — max 3 articles fill the top starter
 *    slots. Remaining foundational articles overflow to the reserved pool.
 * 2. YÖK Theses (relevanceScore: 0.99 from mapped thesis data) — fill remaining
 *    starter slots. Overflow goes to the reserved pool.
 * 3. Semantic OpenAlex — fill any remaining starter slots (by relevanceScore
 *    descending). At most 10 overflow to the reserved pool.
 *
 * Thesis and semantic articles that duplicate foundational titles are silently
 * removed before distribution.
 *
 * @param foundationalArticles - Crossref-resolved foundational works
 * @param thesisArticles - YÖK thesis articles from the risk originality report
 * @param semanticArticles - AI-reviewed OpenAlex semantic search results
 * @returns Starter pack (max 5) and reserved pool with all overflow
 */
export function distributeFixedPool(
  foundationalArticles: JuryArticle[],
  thesisArticles: JuryArticle[],
  semanticArticles: JuryArticle[],
): { starterPack: JuryArticle[]; reservedPool: JuryArticle[] } {
  const starterPack: JuryArticle[] = [];
  const reservedPool: JuryArticle[] = [];

  // Build a dedup set from foundational titles
  const foundationalTitles = new Set(
    foundationalArticles
      .map((a) => a.title?.toLowerCase().trim())
      .filter(Boolean),
  );

  // Remove thesis and semantic articles that duplicate foundational titles
  const dedupedTheses = thesisArticles.filter(
    (a) => !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
  );
  const dedupedSemantic = semanticArticles.filter(
    (a) => !a.title || !foundationalTitles.has(a.title.toLowerCase().trim()),
  );

  // Remove thesis duplicates from semantic list (thesis takes priority)
  const thesisTitles = new Set(
    dedupedTheses.map((a) => a.title?.toLowerCase().trim()).filter(Boolean),
  );
  const finalSemantic = dedupedSemantic.filter(
    (a) => !a.title || !thesisTitles.has(a.title.toLowerCase().trim()),
  );

  // Sort each tier by relevanceScore descending
  const sortedFoundational = [...foundationalArticles].sort(
    (a, b) => b.relevanceScore - a.relevanceScore,
  );
  const sortedTheses = [...dedupedTheses].sort(
    (a, b) => b.relevanceScore - a.relevanceScore,
  );
  const sortedSemantic = [...finalSemantic].sort(
    (a, b) => b.relevanceScore - a.relevanceScore,
  );

  // Tier 1: Foundational — max 3 to starter, rest to reserved
  const foundationalForStarter = sortedFoundational.slice(
    0,
    MAX_FOUNDATIONAL_IN_STARTER,
  );
  const foundationalOverflow = sortedFoundational.slice(
    MAX_FOUNDATIONAL_IN_STARTER,
  );
  starterPack.push(...foundationalForStarter);
  reservedPool.push(...foundationalOverflow);

  // Tier 2: YÖK Theses — fill remaining starter slots, rest to reserved
  let remaining = STARTER_PACK_SIZE - starterPack.length;
  const thesisForStarter = sortedTheses.slice(0, remaining);
  const thesisOverflow = sortedTheses.slice(remaining);
  starterPack.push(...thesisForStarter);
  reservedPool.push(...thesisOverflow);

  // Tier 3: Semantic OpenAlex — fill remaining starter, max 10 to reserved
  remaining = STARTER_PACK_SIZE - starterPack.length;
  const semanticForStarter = sortedSemantic.slice(0, remaining);
  const semanticForReserved = sortedSemantic.slice(
    remaining,
    remaining + RESERVED_SEMANTIC_MAX,
  );
  starterPack.push(...semanticForStarter);
  reservedPool.push(...semanticForReserved);

  return { starterPack, reservedPool };
}

// ============================================================================
// runBoxPipeline — distribution for a single box
// ============================================================================

/**
 * Runs a single box through the post-search distribution pipeline:
 * Distributes articles into the hybrid 3-tier 5+10 pool
 * (foundational → YÖK theses → semantic).
 *
 * @param box - The sub-box metadata
 * @param candidates - Validated papers from OpenAlex (already deduplicated)
 * @param foundationalArticles - Pre-resolved foundational works
 * @param thesisArticles - YÖK thesis articles mapped via library_resources
 * @param logger - Logger instance
 * @returns The distributed starter pack and reserved pool
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
  }));

  return distributeFixedPool(
    foundationalArticles,
    thesisArticles,
    semanticArticles,
  );
}
