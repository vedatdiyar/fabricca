/** Turkish display labels for thesis roles and overlap axes. */
export const statusTranslation: Record<string, string> = {
  HIGH_RISK: "Kritik Çakışma",
  MEDIUM_RISK: "Sınırdaş Çalışma",
  LOW_RISK: "Zemin Çalışma",
  ZERO_RISK: "Özgün Çalışma",
  HIGH: "ÖNEMLİ",
  PARTIAL: "KISMİ",
  NONE: "ÖZGÜN",
};

/**
 * Role & axis badge color dictionary.
 * - LOW_RISK (Zemin Çalışma) → success/green (destekleyici, pozitif)
 * - MEDIUM_RISK (Sınırdaş Çalışma) → info/blue (nötr, bilgilendirici)
 * - HIGH_RISK (Kritik Çakışma) → destructive/red (uyarı)
 * - HIGH → destructive/red (güçlü çakışma, ÖNEMLİ)
 * - PARTIAL → info/blue (bilgilendirici kısmi çakışma)
 * - NONE → success/green (çakışma yok, özgün)
 * bg/border use soft transparency (max /20); text is always 100% opaque
 * — per AGENTS.md styling rules.
 */
export const BADGE_COLORS: Record<string, string> = {
  HIGH_RISK: "bg-destructive/10 border-destructive/20 text-destructive",
  MEDIUM_RISK: "bg-info/10 border-info/20 text-info",
  LOW_RISK: "bg-success/10 border-success/20 text-success",
  ZERO_RISK: "bg-success/10 border-success/20 text-success",
  HIGH: "bg-destructive/10 border-destructive/20 text-destructive",
  PARTIAL: "bg-info/10 border-info/20 text-info",
  NONE: "bg-success/10 border-success/20 text-success",
};

/** Returns the badge color class for a given risk level / axis key. */
export const getBadgeColor = (key: string): string =>
  BADGE_COLORS[key] ?? BADGE_COLORS.ZERO_RISK;
