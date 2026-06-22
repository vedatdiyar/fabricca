/** Turkish display labels for AxesOption values. */
export const AXIS_LABELS: Record<string, string> = {
  BIREBIR: "Birebir",
  KAPSAYAN: "Kapsayan",
  TEGET: "Teğet",
  ALAKASIZ: "Alakasız",
};

/** Turkish display labels for originality badge values. */
export const BADGE_LABELS: Record<string, string> = {
  KRITIK_CAKISMA: "Kritik Çakışma",
  SINIRDAS_CALISMA: "Sınırdaş Çalışma",
  BESLEYICI_CALISMA: "Besleyici Çalışma",
  OZGUN_CALISMA: "Özgün Çalışma",
};

/**
 * Badge color dictionary keyed by axis/badge value.
 * - KRITIK_CAKISMA / BIREBIR → destructive/red (güçlü çakışma)
 * - SINIRDAS_CALISMA / KAPSAYAN → info/blue (sınırda/kısmi)
 * - BESLEYICI_CALISMA / TEGET → warning/yellow (besleyici/teğet)
 * - OZGUN_CALISMA / ALAKASIZ → success/green (özgün/alakasız)
 * bg/border use soft transparency (max /20); text is always 100% opaque
 * — per AGENTS.md styling rules.
 */
export const BADGE_COLORS: Record<string, string> = {
  KRITIK_CAKISMA: "bg-destructive/10 border-destructive/20 text-destructive",
  SINIRDAS_CALISMA: "bg-info/10 border-info/20 text-info",
  BESLEYICI_CALISMA: "bg-warning/10 border-warning/20 text-warning",
  OZGUN_CALISMA: "bg-success/10 border-success/20 text-success",
  BIREBIR: "bg-destructive/10 border-destructive/20 text-destructive",
  KAPSAYAN: "bg-info/10 border-info/20 text-info",
  TEGET: "bg-warning/10 border-warning/20 text-warning",
  ALAKASIZ: "bg-success/10 border-success/20 text-success",
};

/** Returns the badge color class for a given risk level / axis key. */
export const getBadgeColor = (key: string): string =>
  BADGE_COLORS[key] ?? BADGE_COLORS.OZGUN_CALISMA;
