/** Turkish display labels for originality badge values. */
export const BADGE_LABELS: Record<string, string> = {
  KRITIK_CAKISMA: "Kritik Çakışma",
  SINIRDAS_CALISMA: "Sınırdaş Çalışma",
  BESLEYICI_CALISMA: "Besleyici Çalışma",
  OZGUN_CALISMA: "Özgün Çalışma",
};

/**
 * Badge color dictionary keyed by badge value.
 * - KRITIK_CAKISMA → destructive/red (güçlü çakışma)
 * - SINIRDAS_CALISMA → info/blue (sınırda/kısmi)
 * - BESLEYICI_CALISMA → warning/yellow (besleyici)
 * - OZGUN_CALISMA → success/green (özgün)
 * bg/border use soft transparency (max /20); text is always 100% opaque
 * — per AGENTS.md styling rules.
 */
export const BADGE_COLORS: Record<string, string> = {
  KRITIK_CAKISMA: "bg-destructive/10 border-destructive/20 text-destructive",
  SINIRDAS_CALISMA: "bg-info/10 border-info/20 text-info",
  BESLEYICI_CALISMA: "bg-warning/10 border-warning/20 text-warning",
  OZGUN_CALISMA: "bg-success/10 border-success/20 text-success",
};

/** Returns the badge color class for a given risk level key. */
export const getBadgeColor = (key: string): string =>
  BADGE_COLORS[key] ?? BADGE_COLORS.OZGUN_CALISMA;

/**
 * Returns a color class for a dimensional index score (0-100).
 * Used for per-axis gauge bars in the overlap table (container tint).
 *
 * - 0-30:  green  (düşük/özgün)
 * - 31-50: yellow (sınırda/besleyici)
 * - 51-70: orange (orta-yüksek kapsama)
 * - 71-100: red   (yüksek çakışma)
 */
export function getAxisColor(score: number): string {
  if (score <= 30) return "bg-success/10 border-success/20 text-success";
  if (score <= 50) return "bg-warning/10 border-warning/20 text-warning";
  if (score <= 70) return "bg-orange/10 border-orange/20 text-orange";
  return "bg-destructive/10 border-destructive/20 text-destructive";
}

/**
 * Returns a solid fill color for the gauge bar based on the axis score.
 */
export function getAxisBarFill(score: number): string {
  if (score <= 30) return "bg-success";
  if (score <= 50) return "bg-warning";
  if (score <= 70) return "bg-orange";
  return "bg-destructive";
}
