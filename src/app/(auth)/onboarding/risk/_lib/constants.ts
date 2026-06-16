/** Turkish display labels for risk levels and overlap axes. */
export const statusTranslation: Record<string, string> = {
  HIGH_RISK: "YÜKSEK",
  MEDIUM_RISK: "ORTA",
  LOW_RISK: "DÜŞÜK",
  ZERO_RISK: "ORİJİNAL",
  OVERLAPPING: "ORTAK",
  ORIGINAL: "ÖZGÜN",
};

/**
 * Unified badge color dictionary (audit 8.5).
 * bg/border use soft transparency (max /20); text is always 100% opaque
 * — per AGENTS.md styling rules.
 */
export const BADGE_COLORS: Record<string, string> = {
  HIGH_RISK: "bg-destructive/10 border-destructive/20 text-destructive",
  MEDIUM_RISK: "bg-warning/10 border-warning/20 text-warning",
  LOW_RISK: "bg-info/10 border-info/20 text-info",
  ZERO_RISK: "bg-success/10 border-success/20 text-success",
  OVERLAPPING: "bg-destructive/10 border-destructive/20 text-destructive",
  ORIGINAL: "bg-success/10 border-success/20 text-success",
};

/** Returns the badge color class for a given risk level / axis key. */
export const getBadgeColor = (key: string): string =>
  BADGE_COLORS[key] ?? BADGE_COLORS.ZERO_RISK;
