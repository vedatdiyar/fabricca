/**
 * Single source of truth for thesis box type ordering and display labels
 * across the entire application (onboarding, library, dashboard, literature
 * review, prompts).
 *
 * ANALYSIS_ACTORS has been removed — actors are now an integral part
 * of the SUBJECT_PROBLEM quadrant.
 */

/** The four thesis box types. */
export type ThesisBoxType =
  | "SUBJECT_PROBLEM"
  | "THEORETICAL_FRAMEWORK"
  | "METHODOLOGY"
  | "PRIMARY_MATERIAL"
  | "RELATED_THESES";

/** Canonical display ordering: SUBJECT_PROBLEM → THEORETICAL_FRAMEWORK → METHODOLOGY → PRIMARY_MATERIAL. */
export const BOX_ORDER_WEIGHT: Record<ThesisBoxType, number> = {
  SUBJECT_PROBLEM: 1,
  THEORETICAL_FRAMEWORK: 2,
  METHODOLOGY: 3,
  PRIMARY_MATERIAL: 4,
  RELATED_THESES: 5,
};

/** Canonical full (long) Turkish labels. */
export const BOX_TYPE_LABELS: Record<ThesisBoxType, string> = {
  SUBJECT_PROBLEM: "Araştırma Problemi",
  THEORETICAL_FRAMEWORK: "Teorik Çerçeve",
  PRIMARY_MATERIAL: "Birincil Kaynak",
  METHODOLOGY: "Yöntem",
  RELATED_THESES: "İlgili Tezler",
};

/** Canonical short Turkish labels (tabs, compact badges). */
export const BOX_TYPE_SHORT_LABELS: Record<ThesisBoxType, string> = {
  SUBJECT_PROBLEM: "Problem",
  THEORETICAL_FRAMEWORK: "Teori",
  PRIMARY_MATERIAL: "Birincil",
  METHODOLOGY: "Yöntem",
  RELATED_THESES: "İlgili",
};

/** Default parent box definitions (canonical order) for users without completed onboarding. */
export const DEFAULT_PARENT_BOXES: {
  boxType: ThesisBoxType;
  title: string;
}[] = [
  { boxType: "SUBJECT_PROBLEM", title: BOX_TYPE_LABELS.SUBJECT_PROBLEM },
  {
    boxType: "THEORETICAL_FRAMEWORK",
    title: BOX_TYPE_LABELS.THEORETICAL_FRAMEWORK,
  },
  { boxType: "METHODOLOGY", title: BOX_TYPE_LABELS.METHODOLOGY },
  { boxType: "PRIMARY_MATERIAL", title: BOX_TYPE_LABELS.PRIMARY_MATERIAL },
];

/**
 * Resolves the canonical display label for a given box type.
 *
 * @param boxType - The thesis box type value
 * @param short - When true, returns the short label; otherwise the full label
 * @returns The canonical Turkish label, or the raw value when unknown
 */
export function getBoxTypeLabel(
  boxType: ThesisBoxType | string | null | undefined,
  short = false,
): string {
  if (!boxType) return "Genel";
  const key = boxType as ThesisBoxType;
  const label = short ? BOX_TYPE_SHORT_LABELS[key] : BOX_TYPE_LABELS[key];
  return label ?? boxType;
}

/**
 * Comparator for sorting boxes into the canonical display order with unknown box types sorted last.
 *
 * @param boxTypeA - First box type
 * @param boxTypeB - Second box type
 * @returns Negative/zero/positive for canonical ordering
 */
export function compareBoxTypes(
  boxTypeA: ThesisBoxType | string | null | undefined,
  boxTypeB: ThesisBoxType | string | null | undefined,
): number {
  const weightA = BOX_ORDER_WEIGHT[boxTypeA as ThesisBoxType] ?? 99;
  const weightB = BOX_ORDER_WEIGHT[boxTypeB as ThesisBoxType] ?? 99;
  return weightA - weightB;
}

/**
 * UI badge configuration (Tailwind classes + label) for a thesis box type, shared by
 * the library sidebar and resource detail badge renders.
 *
 * @param boxType - The thesis box type value
 * @returns Badge display config with label and styling class names
 */
export function getBoxTypeBadgeConfig(boxType: ThesisBoxType) {
  const base = {
    label: getBoxTypeLabel(boxType),
  };
  switch (boxType) {
    case "THEORETICAL_FRAMEWORK":
      return {
        ...base,
        className:
          "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        dotClassName: "bg-purple-500",
        textClassName: "text-purple-600 dark:text-purple-400",
      };
    case "METHODOLOGY":
      return {
        ...base,
        className:
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        dotClassName: "bg-blue-500",
        textClassName: "text-blue-600 dark:text-blue-400",
      };
    case "SUBJECT_PROBLEM":
      return {
        ...base,
        className:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        dotClassName: "bg-amber-500",
        textClassName: "text-amber-600 dark:text-amber-400",
      };
    case "PRIMARY_MATERIAL":
      return {
        ...base,
        className:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        dotClassName: "bg-emerald-500",
        textClassName: "text-emerald-600 dark:text-emerald-400",
      };
    case "RELATED_THESES":
      return {
        ...base,
        className:
          "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        dotClassName: "bg-rose-500",
        textClassName: "text-rose-600 dark:text-rose-400",
      };
    default:
      return {
        label: "Genel",
        className: "bg-muted text-muted-foreground border-border",
        dotClassName: "bg-muted-foreground",
        textClassName: "text-muted-foreground",
      };
  }
}
