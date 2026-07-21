import type { AcademicBadge } from "@/lib/types";

export const BADGE_ORDER_PRIORITY: Record<AcademicBadge, number> = {
  HIGH_RISK_REPLICATION: 1,
  RELATED_THESIS: 2,
  SAFE_ORIGINAL: 3,
};

export function sortComparisonItems<
  T extends { originalityStatus: AcademicBadge; year: number },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pA = BADGE_ORDER_PRIORITY[a.originalityStatus] ?? 99;
    const pB = BADGE_ORDER_PRIORITY[b.originalityStatus] ?? 99;
    if (pA !== pB) return pA - pB;
    return b.year - a.year;
  });
}
