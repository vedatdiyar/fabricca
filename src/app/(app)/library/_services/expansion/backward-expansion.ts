import { db } from "@/core/db";
import { boxes, sources } from "@/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { CandidateSource } from "./types";
import type { Logger } from "@/lib/logger";
import { filterCandidates, normKey } from "./fuzzy-dedup";
import {
  fetchUserLibraryForDedup,
  buildThesisContext,
} from "./expansion-context";
import { aggregateCoCitations, toRankedCandidates } from "./co-citation";
import {
  rankWithCohereTieBreaker,
  coordinateCandidateSelection,
} from "./selection-coordinator";

export interface BackwardExpansionResult {
  selectedCandidates: CandidateSource[];
  shortfall: number;
}

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
    hidden: true,
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
      hidden: true,
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
  const poolForCohere = confirmedCandidates.slice(0, requiredCount * 2);
  const rerankedPool = await rankWithCohereTieBreaker(
    poolForCohere,
    thesisContext,
  );

  // ── 7. Gemini single call: dedup suspicious + final selection ───────────
  const selectedCandidates = await coordinateCandidateSelection({
    thesisContext,
    rerankedPool,
    suspicious,
    suspiciousCandidates,
    allUserSources,
    requiredCount,
  });

  const shortfall = Math.max(0, requiredCount - selectedCandidates.length);

  logger?.info("backward_expansion_success", {
    service: "literature",
    hidden: true,
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
