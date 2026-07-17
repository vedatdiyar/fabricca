import type { CalculatedComparisonItem } from "../_services/decision-engine";

export const BADGE_ORDER_PRIORITY: Record<string, number> = {
  TWIN_THESIS_ALERT: 1,
  CRITICAL_REPLICATION_ALERT: 2,
  METHODOLOGY_REFERENCE: 3,
  THEORETICAL_ANCHOR: 4,
  CONTEXTUAL_COMPARISON: 5,
  HISTORICAL_CONTEXT: 6,
  FUTURE_PROJECTION: 7,
  EMPIRICAL_BENCHMARK: 8,
  BACKGROUND_LITERATURE: 9,
  IRRELEVANT_DATA: 10,
};

export const BUCKET_ORDER: Record<string, number> = {
  RISK: 1,
  CONTRIBUTION: 2,
  IRRELEVANT: 3,
};

export function sortComparisonItems(
  items: CalculatedComparisonItem[],
): CalculatedComparisonItem[] {
  return [...items].sort((a, b) => {
    if (a.bucket !== b.bucket) {
      const bA = BUCKET_ORDER[a.bucket] ?? 99;
      const bB = BUCKET_ORDER[b.bucket] ?? 99;
      return bA - bB;
    }
    if (a.relevanceScore !== b.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    const pA = BADGE_ORDER_PRIORITY[a.primaryBadge] ?? 99;
    const pB = BADGE_ORDER_PRIORITY[b.primaryBadge] ?? 99;
    if (pA !== pB) return pA - pB;
    return b.year - a.year;
  });
}
