import type { OverlapLevel } from "@/lib/types";

export type ThesisBadge = "IKIZ" | "SINIRDAS" | "OZGUN";

export function calculateBadge(axes: {
  subject: OverlapLevel;
  theory: OverlapLevel;
  methodology: OverlapLevel;
  context?: OverlapLevel;
}): ThesisBadge {
  const c = axes.context ?? "OZGUN";
  if (
    axes.subject === "KRITIK" &&
    axes.theory === "KRITIK" &&
    axes.methodology === "KRITIK" &&
    c === "KRITIK"
  )
    return "IKIZ";
  if (axes.subject === "OZGUN" || c === "OZGUN") return "OZGUN";
  return "SINIRDAS";
}
