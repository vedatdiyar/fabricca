import type { CalculatedComparisonItem } from "../_services/decision-engine";

export const BADGE_ORDER_PRIORITY: Record<string, number> = {
  TWIN_THESIS_ALERT: 1,
  CRITICAL_REPLICATION_ALERT: 2,
  INDEPENDENT_CONCEPTUAL_STUDY: 3,
  INNOVATIVE_EXPLORATION: 4,
  HORIZON_EXPANSION: 5,
  METHODOLOGICAL_REVOLUTION: 6,
  GEOGRAPHIC_REPRESENTATION: 7,
  METHOD_DRIVEN_ANALYSIS: 8,
  THEMATIC_INITIATIVE: 9,
  BALANCED_SCHOLARLY_CONTRIBUTION: 10,
  EMPIRICAL_ADAPTATION: 11,
  CONTEXTUAL_MODEL_TRANSFER: 12,
  CONCEPTUAL_MODEL_TRANSFER: 13,
  VALIDATION_STUDY: 14,
  METHODOLOGICAL_INNOVATION: 15,
  METHODOLOGICAL_RECONSTRUCTION: 16,
  THEORETICAL_RECONSTRUCT: 17,
  METHODOLOGICAL_CONTRAST: 18,
  DIALECTICAL_CONTRIBUTION: 19,
  PARADIGM_CHALLENGE: 20,
  THEMATIC_EXPANSION: 21,
  INCREMENTAL_CLAIM_CONTRIBUTION: 22,
  SPATIAL_REPLICATION: 23,
  LOCAL_VALIDATION_STUDY: 24,
  HIGH_LITERATURE_PARALLELISM: 25,
  NARROW_SCOPE_REPLICATION: 26,
  TEMPORAL_FOLLOW_UP: 27,
  BORDERLINE_SIMILARITY_ALERT: 28,
  TEMPORAL_UPDATE_STUDY: 29,
  IRRELEVANT_DATA: 30,
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
    const pA = BADGE_ORDER_PRIORITY[a.primaryBadge] ?? 99;
    const pB = BADGE_ORDER_PRIORITY[b.primaryBadge] ?? 99;
    if (pA !== pB) return pA - pB;
    if (a.relevanceScore !== b.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return b.year - a.year;
  });
}
