import type { CalculatedComparisonItem } from "../_services/decision-engine";

export const BADGE_ORDER_PRIORITY: Record<string, number> = {
  DUPLICATE_THESIS_RISK: 1,
  EMPIRICAL_FOUNDATION_SOURCE: 2,
  DIALECTICAL_DISCUSSION_SUPPORT: 3,
  THEMATIC_SYNTHESIS_OPPORTUNITY: 4,
  CROSS_CONTEXTUAL_VALIDATION: 5,
  METHODOLOGICAL_AND_THEORETICAL_PEER: 6,
  HISTORICAL_BASELINE_DATA: 7,
  FUTURE_PROSPECTIVE_CONTEXT: 8,
  MACRO_STRUCTURAL_CONTEXT: 9,
  PARALLEL_LITERATURE_REFERENCE: 10,
  IRRELEVANT_DATA: 11,
};

export const BUCKET_ORDER: Record<string, number> = {
  RISK: 1,
  CONTRIBUTION: 2,
  IRRELEVANT: 3,
};

/**
 * Sorts comparison items by bucket priority (RISK > CONTRIBUTION > NOISE),
 * then by primary badge priority, then by relevance score, then by year.
 *
 * @param items - The comparison items to sort
 * @returns A new sorted array
 */
export function sortComparisonItems(
  items: CalculatedComparisonItem[],
): CalculatedComparisonItem[] {
  return [...items].sort((a, b) => {
    if (a.bucket !== b.bucket) {
      const bA = BUCKET_ORDER[a.bucket] ?? 99;
      const bB = BUCKET_ORDER[b.bucket] ?? 99;
      return bA - bB;
    }
    const pA = BADGE_ORDER_PRIORITY[a.primaryBadge] ?? 99;
    const pB = BADGE_ORDER_PRIORITY[b.primaryBadge] ?? 99;
    if (pA !== pB) return pA - pB;
    if (a.relevanceScore !== b.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return b.year - a.year;
  });
}
