import type { OverlapLevel } from "@/lib/types";

export type ThesisBadge = "IKIZ" | "SINIRDAS" | "OZGUN";

export function calculateBadge(axes: {
  subject: OverlapLevel;
  theory: OverlapLevel;
  methodology: OverlapLevel;
  context?: OverlapLevel;
}): ThesisBadge {
  const s = axes.subject;
  const c = axes.context ?? "OZGUN";
  const t = axes.theory;
  const m = axes.methodology;

  // 1. EĞER (Subject === KRITIK ve Context === KRITIK) VE (Theory === KRITIK veya Methodology === KRITIK) ise -> IKIZ
  if (s === "KRITIK" && c === "KRITIK" && (t === "KRITIK" || m === "KRITIK")) {
    return "IKIZ";
  }

  // 2. EĞER (Subject === KRITIK ve Context === KRITIK) ise -> SINIRDAS
  if (s === "KRITIK" && c === "KRITIK") {
    return "SINIRDAS";
  }

  // 3. EĞER (Subject === KRITIK veya Context === KRITIK) VE (Subject === ORTA veya Context === ORTA) ise -> SINIRDAS
  if ((s === "KRITIK" || c === "KRITIK") && (s === "ORTA" || c === "ORTA")) {
    return "SINIRDAS";
  }

  // 4. KALAN TÜM DURUMLARDA -> OZGUN
  return "OZGUN";
}
