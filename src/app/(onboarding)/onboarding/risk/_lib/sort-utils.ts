import type { CalculatedComparisonItem } from "../_services/decision-engine";

export const BADGE_ORDER_PRIORITY: Record<string, number> = {
  CRITICAL_OVERLAP: 1,
  APPROACH_DIVERGENCE: 2,
  DIALECTICAL_OPPORTUNITY: 3,
  LITERATURE_BRIDGE: 4,
  THEMATIC_SYNTHESIS: 5,
  IRRELEVANT_DATA: 6,
};

export const BUCKET_ORDER: Record<string, number> = {
  RISK: 1,
  CONTRIBUTION: 2,
  IRRELEVANT: 3,
};

/**
 * Sorts comparison items by bucket priority (RISK > CONTRIBUTION > NOISE),
 * then by primary badge priority, then by year (newest first).
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
    return b.year - a.year;
  });
}
