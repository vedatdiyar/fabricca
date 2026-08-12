/**
 * Backward Expansion — Co-Citation Count Algorithm
 *
 * Scoring model (replaces the broken in-text frequency heuristic):
 *
 *   PRIMARY SCORE  : Co-citation count — how many of the N active seed sources
 *                    cite this reference in their parsed_references list.
 *                    Range: 1..N. A score of N means every seed cites the work.
 *
 *   TIE-BREAKER    : Cohere Rerank relevance score against the thesis box context,
 *                    applied only when multiple candidates share the same
 *                    co-citation count. This avoids the Cohere call when a clear
 *                    winner exists at the top co-citation tier.
 *
 *   DEDUP PIPELINE :
 *     1. DOI exact match          → certain duplicate, skip
 *     2. Alphanumeric title match → certain duplicate, skip
 *     3. Jaccard(title) + Jaro-Winkler(author) fuzzy check
 *          ≥ CERTAIN thresholds   → skip
 *          ≥ SUSPICIOUS thresholds → flag for LLM review
 *     4. Cerebras Gemma-4-31B single call:
 *          - Verifies suspicious candidates (cross-language / edition awareness)
 *          - Selects final N from the confirmed+cleared pool in thesis context
 */

import { db } from "@/db";
import { boxes, matrices, sources, type ParsedReference } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { CandidateSource } from "./types";
import type { Logger } from "@/lib/logger";
import { filterCandidates, normalizeTurkishChars } from "./fuzzy-dedup";
import type { SuspiciousEntry } from "./cerebras-selection-client";
import { selectWithCerebras } from "./cerebras-selection-client";
import { rerankWithCohere } from "@/services/ai/cohere";

export interface BackwardExpansionResult {
  selectedCandidates: CandidateSource[];
  shortfall: number;
}

/** A single co-citation entry keyed by normalized title across the seed pool. */
interface CoCitationEntry {
  ref: ParsedReference;
  coCitationCount: number;
  seedTitles: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Strips everything except lowercase ASCII alphanumerics.
 * Used for bucket-key deduplication across candidate references.
 */
function normKey(title: string): string {
  return normalizeTurkishChars(title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Fetches every source belonging to the given thesis matrix, so the dedup pass
 * can catch works already present in the library under a different box/title.
 *
 * @param matrixId - The user's thesis matrix ID.
 * @returns All user sources across the matrix boxes.
 */
async function fetchUserLibraryForDedup(
  matrixId: number,
): Promise<{ title: string; doi: string | null; authors: string[] | null }[]> {
  const userBoxes = await db
    .select({ id: boxes.id })
    .from(boxes)
    .where(eq(boxes.matrixId, matrixId));

  const userBoxIds = userBoxes.map((b) => b.id);
  if (userBoxIds.length === 0) return [];

  return db
    .select({
      title: sources.title,
      doi: sources.doi,
      authors: sources.authors,
    })
    .from(sources)
    .where(inArray(sources.boxId, userBoxIds));
}

/**
 * Builds the thesis context used as the rerank query and LLM selection prompt:
 * the box title/description joined with the matrix subject problem and
 * theoretical framework.
 *
 * @param matrixId - The user's thesis matrix ID (may be null).
 * @param boxId - The target sub-box ID.
 * @returns The combined context string.
 */
async function buildThesisContext(
  matrixId: number | null,
  boxId: number,
): Promise<string> {
  let thesisContext = "";
  if (matrixId) {
    const [matrixRow] = await db
      .select({
        subjectProblem: matrices.subjectProblem,
        theoreticalFramework: matrices.theoreticalFramework,
      })
      .from(matrices)
      .where(eq(matrices.id, matrixId));
    if (matrixRow) {
      thesisContext = `${matrixRow.subjectProblem}. ${matrixRow.theoreticalFramework}`;
    }
  }

  const [boxDetail] = await db
    .select({ title: boxes.title, description: boxes.description })
    .from(boxes)
    .where(eq(boxes.id, boxId));

  if (boxDetail) {
    thesisContext =
      `${boxDetail.title}. ${boxDetail.description ?? ""}. ${thesisContext}`.trim();
  }

  return thesisContext;
}

/**
 * Aggregates parsed references across all seed sources into a co-citation map,
 * keyed by normalized title. A single seed listing the same work twice only
 * counts once.
 *
 * @param seedSources - The active seed source rows.
 * @returns Map of normalized title → co-citation entry.
 */
function aggregateCoCitations(
  seedSources: Array<{ title: string; parsedReferences: unknown }>,
): Map<string, CoCitationEntry> {
  const coCitationMap = new Map<string, CoCitationEntry>();

  for (const seed of seedSources) {
    const parsedList = (seed.parsedReferences as ParsedReference[]) ?? [];
    const seenInThisSeed = new Set<string>();

    for (const ref of parsedList) {
      if (!ref.title || ref.title.trim().length < 5) continue;

      const key = normKey(ref.title);
      if (!key) continue;
      if (seenInThisSeed.has(key)) continue;
      seenInThisSeed.add(key);

      const existing = coCitationMap.get(key);
      if (existing) {
        existing.coCitationCount += 1;
        existing.seedTitles.push(seed.title);
      } else {
        coCitationMap.set(key, {
          ref,
          coCitationCount: 1,
          seedTitles: [seed.title],
        });
      }
    }
  }

  return coCitationMap;
}

/**
 * Ranks the co-citation map into a CandidateSource array, ordered by
 * co-citation count (primary) then publication year descending (secondary).
 *
 * @param coCitationMap - The aggregated co-citation map.
 * @returns Ranked backward candidates.
 */
function toRankedCandidates(
  coCitationMap: Map<string, CoCitationEntry>,
): CandidateSource[] {
  const sorted = Array.from(coCitationMap.values()).sort((a, b) => {
    if (b.coCitationCount !== a.coCitationCount) {
      return b.coCitationCount - a.coCitationCount;
    }
    return (b.ref.year ?? 0) - (a.ref.year ?? 0);
  });

  return sorted.map((item) => {
    const authors = item.ref.authors.map((a) => a.name).filter(Boolean);
    return {
      title: item.ref.title ?? "Untitled Reference",
      authors: authors.length > 0 ? authors : ["Unknown Author"],
      publisher: item.ref.publisher ?? item.ref.containerTitle ?? undefined,
      publicationYear: item.ref.year ?? undefined,
      relevanceScore: item.coCitationCount,
      sourceOrigin: "backward",
      rawParsedRef: item.ref.raw,
    };
  });
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Executes backward expansion for a box using co-citation count scoring.
 *
 * @param boxId        - Target Sub-Box ID.
 * @param activeSeedIds - IDs of the active seed sources.
 * @param requiredCount - Desired number of backward sources (2 normally, 4 when forward is unavailable).
 * @param logger       - Optional structured logger.
 * @returns BackwardExpansionResult with selected candidates and shortfall count.
 */
export async function executeBackwardExpansion(
  boxId: number,
  activeSeedIds: number[],
  requiredCount = 2,
  logger?: Logger,
): Promise<BackwardExpansionResult> {
  logger?.info("backward_expansion_start", {
    service: "literature",
    data: {
      boxId,
      seedCount: activeSeedIds.length,
      requiredCount,
    },
  });

  if (activeSeedIds.length === 0) {
    return { selectedCandidates: [], shortfall: requiredCount };
  }

  // ── 1. Fetch active seed sources ──────────────────────────────────────────
  const seedSources = await db
    .select()
    .from(sources)
    .where(inArray(sources.id, activeSeedIds));

  if (seedSources.length === 0) {
    return { selectedCandidates: [], shortfall: requiredCount };
  }

  // ── 2. Load matrix context + full user library for cross-library dedup ────
  const [boxRow] = await db
    .select({ matrixId: boxes.matrixId })
    .from(boxes)
    .where(eq(boxes.id, boxId));

  const matrixId = boxRow?.matrixId ?? null;

  const [allUserSources, thesisContext] = await Promise.all([
    matrixId
      ? fetchUserLibraryForDedup(matrixId)
      : Promise.resolve(
          [] as {
            title: string;
            doi: string | null;
            authors: string[] | null;
          }[],
        ),
    buildThesisContext(matrixId, boxId),
  ]);

  // ── 3. Aggregate parsed references → co-citation count map ────────────────
  const coCitationMap = aggregateCoCitations(seedSources);

  if (coCitationMap.size === 0) {
    logger?.info("backward_expansion_success", {
      service: "literature",
      blank: "none",
      data: {
        boxId,
        candidatePoolSize: 0,
        selectedCount: 0,
        shortfall: requiredCount,
      },
    });
    return { selectedCandidates: [], shortfall: requiredCount };
  }

  // ── 4. Sort + map to CandidateSource array ────────────────────────────────
  const rawCandidates = toRankedCandidates(coCitationMap);

  // ── 5. Fuzzy dedup against all user sources ───────────────────────────────
  const { confirmed, suspicious, removed } = filterCandidates(
    rawCandidates.map((c) => ({
      title: c.title,
      doi: c.doi ?? null,
      authors: c.authors,
    })),
    allUserSources,
  );

  logger?.info("backward_expansion_dedup", {
    service: "literature",
    data: {
      boxId,
      totalCandidates: rawCandidates.length,
      confirmedUnique: confirmed.length,
      suspicious: suspicious.length,
      removedAsCertain: removed.length,
    },
  });

  // Map confirmed/suspicious titles back to CandidateSource objects (preserve order)
  const confirmedTitleSet = new Set(confirmed.map((c) => normKey(c.title)));
  const suspiciousTitleSet = new Set(suspicious.map((c) => normKey(c.title)));

  const confirmedCandidates = rawCandidates.filter((c) =>
    confirmedTitleSet.has(normKey(c.title)),
  );
  const suspiciousCandidates = rawCandidates.filter((c) =>
    suspiciousTitleSet.has(normKey(c.title)),
  );

  // ── 6. Cohere rerank of confirmed pool (tie-breaker within same co-citation tier) ──
  // We send requiredCount × 2 candidates to keep context window manageable for Cerebras.
  const poolForCohere = confirmedCandidates.slice(0, requiredCount * 2);

  let rerankedPool = poolForCohere;

  if (poolForCohere.length > 1 && thesisContext && process.env.COHERE_API_KEY) {
    try {
      const documents = poolForCohere.map(
        (c) => `${c.title}. ${c.authors.join(", ")}. ${c.publisher ?? ""}`,
      );

      const rerankResults = await rerankWithCohere({
        query: thesisContext.substring(0, 4000),
        documents,
      });

      // Sort by Cohere score but preserve co-citation primacy:
      // multiply co-citation count × 1000 and add Cohere score so higher
      // co-citation always wins over lower co-citation regardless of Cohere.
      const scoredList = rerankResults.map((res) => {
        const c = poolForCohere[res.index];
        const combinedScore =
          (c?.relevanceScore ?? 0) * 1000 + res.relevanceScore;
        return { candidate: c, combinedScore };
      });

      scoredList.sort((a, b) => b.combinedScore - a.combinedScore);
      rerankedPool = scoredList
        .filter((s) => s.candidate !== undefined)
        .map((s) => s.candidate!);
    } catch {
      // Cohere unavailable — fall back to co-citation order
    }
  }

  // ── 7. Cerebras single call: dedup suspicious + final selection ───────────
  const allCandidatesForLlm = [...rerankedPool, ...suspiciousCandidates];

  const suspiciousEntries: SuspiciousEntry[] = suspicious.map((s) => ({
    candidateTitle: s.title,
    candidateAuthors: s.authors,
    matchedExistingTitle: s.matchedTitle,
    titleScore: s.titleScore,
    authorScore: s.authorScore,
  }));

  const existingSnippets = allUserSources.map((s) => ({
    title: s.title,
    authors: s.authors ?? [],
  }));

  const selectedCandidates = await selectWithCerebras(
    {
      thesisContext,
      confirmedCandidates: rerankedPool.map((c, i) => ({
        index: i,
        title: c.title,
        authors: c.authors,
        coAuthorCount: c.relevanceScore ?? 0,
      })),
      suspiciousCandidates: suspiciousEntries,
      existingSources: existingSnippets,
      targetCount: requiredCount,
    },
    allCandidatesForLlm,
  );

  const shortfall = Math.max(0, requiredCount - selectedCandidates.length);

  logger?.info("backward_expansion_success", {
    service: "literature",
    blank: "none",
    data: {
      boxId,
      candidatePoolSize: coCitationMap.size,
      confirmedCount: confirmed.length,
      suspiciousCount: suspicious.length,
      removedCount: removed.length,
      selectedCount: selectedCandidates.length,
      shortfall,
      requiredCount,
    },
  });

  return { selectedCandidates, shortfall };
}
