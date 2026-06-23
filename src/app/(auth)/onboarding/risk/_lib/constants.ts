import type { OverlapLevel } from "@/lib/types";

/** Turkish display labels for originality badge values. */
export const BADGE_LABELS: Record<string, string> = {
  KRITIK_CAKISMA: "Kritik Çakışma",
  SINIRDAS_CALISMA: "Sınırdaş Çalışma",
  BESLEYICI_CALISMA: "Destekleyici Çalışma",
  OZGUN_CALISMA: "Özgün Çalışma",
};

/**
 * Badge color dictionary keyed by badge value.
 * - KRITIK_CAKISMA → destructive/red (güçlü çakışma)
 * - SINIRDAS_CALISMA → info/blue (sınırda/kısmi)
 * - BESLEYICI_CALISMA → warning/yellow (destekleyici)
 * - OZGUN_CALISMA → success/green (özgün)
 * bg/border use soft transparency (max /20); text is always 100% opaque
 * — per AGENTS.md styling rules.
 */
export const BADGE_COLORS: Record<string, string> = {
  KRITIK_CAKISMA: "bg-destructive/20 border-destructive/20 text-destructive",
  SINIRDAS_CALISMA: "bg-info/20 border-info/20 text-info",
  BESLEYICI_CALISMA: "bg-warning/20 border-warning/20 text-warning",
  OZGUN_CALISMA: "bg-success/20 border-success/20 text-success",
};

/** Returns the badge color class for a given risk level key. */
export const getBadgeColor = (key: string): string =>
  BADGE_COLORS[key] ?? BADGE_COLORS.OZGUN_CALISMA;

/** Turkish display labels for per-axis overlap levels. */
export const OVERLAP_LEVEL_LABELS: Record<OverlapLevel, string> = {
  KRITIK: "Kritik",
  YUKSEK: "Yüksek",
  ORTA: "Orta",
  DUSUK: "Düşük",
  YOK: "Yok",
};

/**
 * Badge color classes for per-axis overlap levels.
 * Maps each categorical level to a distinct semantic color.
 */
export const OVERLAP_LEVEL_COLORS: Record<OverlapLevel, string> = {
  KRITIK: "bg-destructive/20 border-destructive/20 text-destructive",
  YUKSEK: "bg-orange/20 border-orange/20 text-orange",
  ORTA: "bg-warning/20 border-warning/20 text-warning",
  DUSUK: "bg-success/20 border-success/20 text-success",
  YOK: "bg-muted/20 border-muted/20 text-muted-foreground",
};

/**
 * Returns a color class for a given categorical overlap level.
 * Used for per-axis gauge bars in the overlap table.
 */
export function getOverlapLevelColor(level: OverlapLevel): string {
  return OVERLAP_LEVEL_COLORS[level] ?? OVERLAP_LEVEL_COLORS.YOK;
}

/**
 * Returns a solid fill color for the gauge bar based on the overlap level.
 */
export function getOverlapLevelBarFill(level: OverlapLevel): string {
  switch (level) {
    case "KRITIK":
      return "bg-destructive";
    case "YUKSEK":
      return "bg-orange";
    case "ORTA":
      return "bg-warning";
    case "DUSUK":
      return "bg-success";
    case "YOK":
      return "bg-muted";
  }
}
