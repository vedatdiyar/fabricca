import type { ThesisDetails } from "@/lib/types";

/** Constant for Reciprocal Rank Fusion smoothing (standard: 60). */
const RRF_K = 60;

/** Minimum abstract character length for a thesis to be considered evaluable. */
const MIN_ABSTRACT_LENGTH = 50;

/**
 * Combines multiple ranked candidate lists from parallel thesis index searches
 * using Reciprocal Rank Fusion (RRF).
 *
 * @param searchLists - Array of thesis result arrays from distinct query aspects.
 * @param k - Smoothing constant.
 * @returns Deduplicated array of candidate theses sorted by descending RRF score.
 */
export function reciprocalRankFusion(
  searchLists: ThesisDetails[][],
  k = RRF_K,
): ThesisDetails[] {
  const scoreMap = new Map<
    number,
    { thesis: ThesisDetails; score: number }
  >();

  for (const list of searchLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const thesis = list[rank];
      if (!thesis || !thesis.id) continue;

      const rrfIncrement = 1 / (k + (rank + 1));
      const existing = scoreMap.get(thesis.id);

      if (existing) {
        existing.score += rrfIncrement;
      } else {
        scoreMap.set(thesis.id, { thesis, score: rrfIncrement });
      }
    }
  }

  const fused = Array.from(scoreMap.values());
  fused.sort((a, b) => b.score - a.score);

  return fused.map((item) => item.thesis);
}

/**
 * Filters out invalid candidate theses that lack meaningful content, titles, or abstracts.
 *
 * @param candidates - The array of candidate theses to validate.
 * @returns Filtered candidates array with valid content.
 */
export function filterValidCandidates(
  candidates: ThesisDetails[],
): ThesisDetails[] {
  const seenIds = new Set<number>();
  const valid: ThesisDetails[] = [];

  for (const thesis of candidates) {
    if (!thesis.id || seenIds.has(thesis.id)) continue;
    if (!thesis.title || thesis.title.trim().length === 0) continue;

    const abstractText = (thesis.abstract || "").trim();
    if (abstractText.length < MIN_ABSTRACT_LENGTH) continue;

    seenIds.add(thesis.id);
    valid.push(thesis);
  }

  return valid;
}
