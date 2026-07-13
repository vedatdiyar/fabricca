import type { AnalysisBadge, RelationshipBadge } from "@/lib/types";

// ============================================================================
// Global İlişki Rozeti (4'lü) — Risk Sayfasının Üst Bandı
// ============================================================================

/** Türkçe görüntü etiketleri — 4 global ilişki rozeti */
export const RELATIONSHIP_BADGE_LABELS: Record<RelationshipBadge, string> = {
  HIGH_RISK: "Yüksek Risk / Doğrudan Çakışma",
  SALVAGEABLE: "Farklılaştırmayla Kurtarılabilir",
  CONTRIBUTION: "Katkı Sağlayan Literatür",
  UNRELATED: "Alakasız / Havuz Sızıntısı",
};

/** Tam badge renk kombinasyonu (bg + border + text) */
export const RELATIONSHIP_BADGE_COLORS: Record<RelationshipBadge, string> = {
  HIGH_RISK: "bg-destructive/10 border-destructive/20 text-destructive",
  SALVAGEABLE: "bg-warning/10 border-warning/20 text-warning",
  CONTRIBUTION: "bg-info/10 border-info/20 text-info",
  UNRELATED: "bg-muted/10 border-border/40 text-muted-foreground",
};

/**
 * Global ilişki rozeti için UI yapılandırmasını döndürür.
 *
 * @param badge - RelationshipBadge kod değeri
 * @returns Türkçe etiket ve Tailwind renk sınıfları
 */
export function getGlobalBadgeConfig(badge: string): {
  text: string;
  bgClass: string;
} {
  const key = badge as RelationshipBadge;
  const text = RELATIONSHIP_BADGE_LABELS[key];
  const bgClass = RELATIONSHIP_BADGE_COLORS[key];
  if (text && bgClass) return { text, bgClass };
  return {
    text: badge,
    bgClass: "bg-muted/10 border-border/40 text-muted-foreground",
  };
}

// ============================================================================
// Bireysel Tez Rozeti (AnalysisBadge) — Kart Görünümü
// ============================================================================

/** Türkçe etiket metinleri */
export const ANALYSIS_BADGE_LABELS: Record<AnalysisBadge, string> = {
  CRITICAL_OVERLAP: "Kritik Çakışma (Yüksek Risk)",
  APPROACH_DIVERGENCE: "Yaklaşım Farklılığı (Kurtarılabilir)",
  DIALECTICAL_OPPORTUNITY: "Akademik Antitez",
  LITERATURE_BRIDGE: "Literatür Köprüsü",
  THEMATIC_SYNTHESIS: "Tematik Sentez",
  IRRELEVANT_DATA: "Bağlam Dışı",
};

/** Kart arka planı ve kenar renk sınıfları */
export const ANALYSIS_BADGE_CARD_STYLE: Record<
  AnalysisBadge,
  { card: string; border: string; text: string }
> = {
  CRITICAL_OVERLAP: {
    card: "bg-destructive/10",
    border: "border-destructive/20",
    text: "text-destructive",
  },
  APPROACH_DIVERGENCE: {
    card: "bg-warning/10",
    border: "border-warning/20",
    text: "text-warning",
  },
  DIALECTICAL_OPPORTUNITY: {
    card: "bg-info/10",
    border: "border-info/20",
    text: "text-info",
  },
  LITERATURE_BRIDGE: {
    card: "bg-info/10",
    border: "border-info/20",
    text: "text-info",
  },
  THEMATIC_SYNTHESIS: {
    card: "bg-success/10",
    border: "border-success/20",
    text: "text-success",
  },
  IRRELEVANT_DATA: {
    card: "bg-muted/40 opacity-70",
    border: "border-border/40",
    text: "text-muted-foreground",
  },
};

/**
 * Bireysel analiz rozeti için UI yapılandırmasını döndürür.
 *
 * @param badge - AnalysisBadge kod değeri
 * @returns Türkçe etiket ve kart/kenar/metin renk sınıfları
 */
export function getAnalysisBadgeConfig(badge: string): {
  label: string;
  card: string;
  border: string;
  text: string;
} {
  const key = badge as AnalysisBadge;
  const label = ANALYSIS_BADGE_LABELS[key];
  const style = ANALYSIS_BADGE_CARD_STYLE[key];
  if (label && style) return { label, ...style };
  return {
    label: badge,
    card: "bg-muted/5",
    border: "border-border/40",
    text: "text-muted-foreground",
  };
}

export function getUiBadgeConfig(badge: string): {
  text: string;
  bgClass: string;
} {
  // Check if it's an AnalysisBadge
  if (badge in ANALYSIS_BADGE_LABELS) {
    const config = getAnalysisBadgeConfig(badge);
    return {
      text: config.label,
      bgClass: `${config.card} border ${config.border} ${config.text}`,
    };
  }

  // Otherwise try global RelationshipBadge
  const globalKey = badge as RelationshipBadge;
  if (globalKey in RELATIONSHIP_BADGE_LABELS) {
    const text = RELATIONSHIP_BADGE_LABELS[globalKey];
    const bgClass = RELATIONSHIP_BADGE_COLORS[globalKey];
    return { text, bgClass };
  }

  // Try mapping old values to new ones for backward compatibility
  const oldMap: Record<string, AnalysisBadge> = {
    TWIN_THESIS: "CRITICAL_OVERLAP",
    TWIN_CANDIDATE: "CRITICAL_OVERLAP",
    SALVAGEABLE_METHOD: "APPROACH_DIVERGENCE",
    SALVAGEABLE_THEORY: "APPROACH_DIVERGENCE",
    NEAR_DISCUSSION: "APPROACH_DIVERGENCE",
    BRIDGE_LINK: "LITERATURE_BRIDGE",
    LITERATURE_ALLY: "LITERATURE_BRIDGE",
    HISTORICAL_BACKGROUND: "LITERATURE_BRIDGE",
    HISTORICAL_ANCHOR: "LITERATURE_BRIDGE",
    FUTURE_LITERATURE: "LITERATURE_BRIDGE",
    THEMATIC_MODEL: "THEMATIC_SYNTHESIS",
    GEO_REPLICATION: "THEMATIC_SYNTHESIS",
    CONTEXTUAL_SUPPORT: "THEMATIC_SYNTHESIS",
    ANTITHESIS: "DIALECTICAL_OPPORTUNITY",
    NOISE: "IRRELEVANT_DATA",
    UNRELATED: "CRITICAL_OVERLAP", // Fallback, not used
  };

  if (badge in oldMap) {
    const mapped = oldMap[badge];
    const config = getAnalysisBadgeConfig(mapped);
    return {
      text: config.label,
      bgClass: `${config.card} border ${config.border} ${config.text}`,
    };
  }

  return {
    text: badge,
    bgClass: "bg-muted/10 border-border/40 text-muted-foreground",
  };
}
