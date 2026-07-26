/**
 * Single source of truth for box type ordering and display labels
 * across the onboarding module.
 */

export const BOX_ORDER_WEIGHT: Record<string, number> = {
  SUBJECT_PROBLEM: 1,
  THEORETICAL_FRAMEWORK: 2,
  ANALYSIS_ACTORS: 3,
  PRIMARY_MATERIAL: 4,
  METHODOLOGY: 5,
};

export const BOX_TYPE_LABELS: Record<string, string> = {
  SUBJECT_PROBLEM: "Araştırma Problemi",
  THEORETICAL_FRAMEWORK: "Teorik Çerçeve",
  ANALYSIS_ACTORS: "Aktörler / Analiz Birimi",
  PRIMARY_MATERIAL: "Veri Kaynağı",
  METHODOLOGY: "Yöntem",
};
