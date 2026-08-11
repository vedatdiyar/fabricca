/**
 * Reciprocal Rank Fusion (RRF) — pure fusion of two independent ranked lists.
 *
 * RRF(d) = 1 / (k + rank_dense(d)) + 1 / (k + rank_lexical(d))
 *
 * A chunk present in only one list contributes a single term; a chunk present in
 * both lists accumulates both terms. No duplicates are ever produced because the
 * fusion collapses by chunk id. Both lists are optional — an empty list is
 * tolerated so a single-branch (or failed-branch) fallback remains a valid
 * RRF-equivalent ranking.
 */

export interface RrfScoredCandidate {
  id: number;
  denseRank?: number;
  lexicalRank?: number;
  rrfScore: number;
}

/**
 * Fuses two independent ranked id lists into RRF scores.
 *
 * @param denseRankedIds - Dense branch chunk ids ordered by descending relevance (first = rank 1).
 * @param lexicalRankedIds - Lexical branch chunk ids ordered by descending relevance (first = rank 1).
 * @param k - RRF constant (default: 60).
 * @returns Map keyed by chunk id with optional per-branch ranks and fused score.
 */
export function computeRrf(
  denseRankedIds: number[],
  lexicalRankedIds: number[],
  k = 60,
): Map<number, RrfScoredCandidate> {
  const scores = new Map<number, RrfScoredCandidate>();

  denseRankedIds.forEach((id, index) => {
    const rank = index + 1;
    scores.set(id, {
      id,
      denseRank: rank,
      rrfScore: 1 / (k + rank),
    });
  });

  lexicalRankedIds.forEach((id, index) => {
    const rank = index + 1;
    const existing = scores.get(id);
    if (existing) {
      existing.lexicalRank = rank;
      existing.rrfScore += 1 / (k + rank);
    } else {
      scores.set(id, {
        id,
        lexicalRank: rank,
        rrfScore: 1 / (k + rank),
      });
    }
  });

  return scores;
}

/**
 * Sorts RRF candidates by descending score (ties broken by chunk id for determinism).
 *
 * @param scored - Map produced by `computeRrf`.
 * @returns Candidates sorted by descending `rrfScore`.
 */
export function sortByRrfScore(
  scored: Map<number, RrfScoredCandidate>,
): RrfScoredCandidate[] {
  return Array.from(scored.values()).sort(
    (a, b) => b.rrfScore - a.rrfScore || a.id - b.id,
  );
}
