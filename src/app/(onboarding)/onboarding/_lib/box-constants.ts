/**
 * Single source of truth for box type ordering and display labels
 * across the onboarding module.
 */

export const BOX_ORDER_WEIGHT: Record<string, number> = {
  PROBLEMATIZATION: 1,
  CONCEPTUAL: 2,
  CONTEXT: 3,
  DATA_PROTOCOL: 4,
  PRIMARY_MATERIAL: 5,
  RELATED_THESES: 6,
};

export const BOX_TYPE_LABELS: Record<string, string> = {
  CONCEPTUAL: "Teorik Çatı",
  PROBLEMATIZATION: "Problematizasyon",
  PRIMARY_MATERIAL: "Birincil Malzeme",
  CONTEXT: "Bağlam",
  DATA_PROTOCOL: "Metodoloji",
  RELATED_THESES: "İlişkisel Tezler",
};
