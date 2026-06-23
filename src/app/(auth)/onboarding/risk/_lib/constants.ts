import type { OverlapLevel, ThesisBadge } from "@/lib/types";

/** Turkish display labels for originality badge values. */
export const THESIS_BADGE_LABELS: Record<ThesisBadge, string> = {
  IKIZ: "İkiz Tez",
  SINIRDAS: "Sınırdaş",
  OZGUN: "Özgün",
};

/**
 * Badge color dictionary keyed by badge value.
 * - IKIZ → destructive/red (güçlü çakışma)
 * - SINIRDAS → warning/yellow (sınırda/kısmi)
 * - OZGUN → success/green (özgün)
 * bg/border use soft transparency (max /20); text is always 100% opaque
 * — per AGENTS.md styling rules.
 */
export const THESIS_BADGE_COLORS: Record<ThesisBadge, string> = {
  IKIZ: "bg-destructive/20 border-destructive/20 text-destructive",
  SINIRDAS: "bg-warning/20 border-warning/20 text-warning",
  OZGUN: "bg-success/20 border-success/20 text-success",
};

/** Returns the badge color class for a given thesis badge key. */
export const getBadgeColor = (key: ThesisBadge): string =>
  THESIS_BADGE_COLORS[key] ?? THESIS_BADGE_COLORS.OZGUN;

/** Turkish display labels for per-axis overlap levels. */
export const OVERLAP_LEVEL_LABELS: Record<OverlapLevel, string> = {
  KRITIK: "Kritik",
  ORTA: "Kısmi",
  OZGUN: "Özgün",
};

/**
 * Badge color classes for per-axis overlap levels.
 * Maps each categorical level to a distinct semantic color.
 */
export const OVERLAP_LEVEL_COLORS: Record<OverlapLevel, string> = {
  KRITIK: "bg-destructive/20 border-destructive/20 text-destructive",
  ORTA: "bg-warning/20 border-warning/20 text-warning",
  OZGUN: "bg-success/20 border-success/20 text-success",
};

/**
 * Returns a color class for a given categorical overlap level.
 * Used for per-axis gauge bars in the overlap table.
 */
export function getOverlapLevelColor(level: OverlapLevel): string {
  return OVERLAP_LEVEL_COLORS[level] ?? OVERLAP_LEVEL_COLORS.OZGUN;
}

/**
 * Returns a solid fill color for the gauge bar based on the overlap level.
 */
export function getOverlapLevelBarFill(level: OverlapLevel): string {
  switch (level) {
    case "KRITIK":
      return "bg-destructive";
    case "ORTA":
      return "bg-warning";
    case "OZGUN":
      return "bg-success";
  }
}
