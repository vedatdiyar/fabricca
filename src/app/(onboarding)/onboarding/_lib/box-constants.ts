/**
 * Single source of truth for box type ordering and display labels
 * across the onboarding module.
 *
 * ANALYSIS_ACTORS has been removed — actors are now an integral part
 * of the SUBJECT_PROBLEM quadrant.
 */

export const BOX_ORDER_WEIGHT: Record<string, number> = {
  SUBJECT_PROBLEM: 1,
  THEORETICAL_FRAMEWORK: 2,
  PRIMARY_MATERIAL: 3,
  METHODOLOGY: 4,
};

export const BOX_TYPE_LABELS: Record<string, string> = {
  SUBJECT_PROBLEM: "Araştırma Problemi",
  THEORETICAL_FRAMEWORK: "Teorik Çerçeve",
  PRIMARY_MATERIAL: "Veri Kaynağı",
  METHODOLOGY: "Yöntem",
};
