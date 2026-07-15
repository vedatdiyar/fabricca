import type { AnalysisBadge, RelationshipBadge } from "@/lib/types";

// ============================================================================
// Global İlişki Rozeti — Risk Sayfasının Üst Bandı
// ============================================================================

/** Türkçe görüntü etiketleri — 3 global ilişki rozeti */
export const RELATIONSHIP_BADGE_LABELS: Record<RelationshipBadge, string> = {
  HIGH_RISK: "Yüksek Risk / Doğrudan Çakışma",
  CONTRIBUTION_READY: "Katkı ve Yararlanmaya Hazır",
  UNRELATED: "Alakasız / Havuz Sızıntısı",
};

/** Tam badge renk kombinasyonu (bg + border + text) */
export const RELATIONSHIP_BADGE_COLORS: Record<RelationshipBadge, string> = {
  HIGH_RISK: "bg-destructive/10 border-destructive/20 text-destructive",
  CONTRIBUTION_READY: "bg-info/10 border-info/20 text-info",
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
// Bireysel Tez Rozeti (11 AnalysisBadge) — Kart Görünümü
// ============================================================================

/** Türkçe etiket metinleri */
export const ANALYSIS_BADGE_LABELS: Record<AnalysisBadge, string> = {
  DUPLICATE_THESIS_RISK: "İkiz Tez Riski (Kritik Çakışma)",
  EMPIRICAL_FOUNDATION_SOURCE: "Ampirik Temellendirme Kaynağı",
  DIALECTICAL_DISCUSSION_SUPPORT: "Diyalektik Tartışma Desteği",
  THEMATIC_SYNTHESIS_OPPORTUNITY: "Tematik Sentez Fırsatı",
  CROSS_CONTEXTUAL_VALIDATION: "Bağlamsal Doğrulama ve Kıyaslama",
  METHODOLOGICAL_AND_THEORETICAL_PEER: "Metodolojik ve Teorik Eş Değer",
  HISTORICAL_BASELINE_DATA: "Tarihsel Referans Verisi",
  FUTURE_PROSPECTIVE_CONTEXT: "Prospektif Gelişim Bağlamı",
  MACRO_STRUCTURAL_CONTEXT: "Makro Yapısal Bağlam Verisi",
  PARALLEL_LITERATURE_REFERENCE: "Paralel Literatür Referansı",
  IRRELEVANT_DATA: "Bağlam Dışı",
};

/** Kart arka planı ve kenar renk sınıfları */
export const ANALYSIS_BADGE_CARD_STYLE: Record<
  AnalysisBadge,
  { card: string; border: string; text: string }
> = {
  DUPLICATE_THESIS_RISK: {
    card: "bg-destructive/10",
    border: "border-destructive/20",
    text: "text-destructive",
  },
  EMPIRICAL_FOUNDATION_SOURCE: {
    card: "bg-success/10",
    border: "border-success/20",
    text: "text-success",
  },
  DIALECTICAL_DISCUSSION_SUPPORT: {
    card: "bg-info/10",
    border: "border-info/20",
    text: "text-info",
  },
  THEMATIC_SYNTHESIS_OPPORTUNITY: {
    card: "bg-success/10",
    border: "border-success/20",
    text: "text-success",
  },
  CROSS_CONTEXTUAL_VALIDATION: {
    card: "bg-info/10",
    border: "border-info/20",
    text: "text-info",
  },
  METHODOLOGICAL_AND_THEORETICAL_PEER: {
    card: "bg-primary/10",
    border: "border-primary/20",
    text: "text-primary",
  },
  HISTORICAL_BASELINE_DATA: {
    card: "bg-muted/20",
    border: "border-border/40",
    text: "text-foreground",
  },
  FUTURE_PROSPECTIVE_CONTEXT: {
    card: "bg-muted/20",
    border: "border-border/40",
    text: "text-foreground",
  },
  MACRO_STRUCTURAL_CONTEXT: {
    card: "bg-muted/10",
    border: "border-border/40",
    text: "text-muted-foreground",
  },
  PARALLEL_LITERATURE_REFERENCE: {
    card: "bg-muted/10",
    border: "border-border/40",
    text: "text-muted-foreground",
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
  if (badge in ANALYSIS_BADGE_LABELS) {
    const config = getAnalysisBadgeConfig(badge);
    return {
      text: config.label,
      bgClass: `${config.card} border ${config.border} ${config.text}`,
    };
  }

  const globalKey = badge as RelationshipBadge;
  if (globalKey in RELATIONSHIP_BADGE_LABELS) {
    const text = RELATIONSHIP_BADGE_LABELS[globalKey];
    const bgClass = RELATIONSHIP_BADGE_COLORS[globalKey];
    return { text, bgClass };
  }

  return {
    text: badge,
    bgClass: "bg-muted/10 border-border/40 text-muted-foreground",
  };
}
