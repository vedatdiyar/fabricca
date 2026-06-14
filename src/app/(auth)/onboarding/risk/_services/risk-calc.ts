import type { Logger } from "@/lib/logger";
import type { TezaraThesisDetails } from "@/lib/types";

export interface CalculatedOverlapItem {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  comparisonNote: string;
  axes: {
    subject: "OVERLAPPING" | "ORIGINAL";
    theory: "OVERLAPPING" | "ORIGINAL";
    methodology: "OVERLAPPING" | "ORIGINAL";
    context?: "OVERLAPPING" | "ORIGINAL";
  };
  originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
  calculated_score: number;
}

export interface CalculatedOriginalityRiskResult {
  originalityBadge: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
  overlapTable: CalculatedOverlapItem[];
  riskPercentage: number;
}

/**
 * Calculates originality risk level using the dominant risk model.
 * Booleans from Gemini are converted to categorical scores/badges
 * via a deterministic conservative condition engine.
 *
 * @param overlapTable - List of candidate theses with boolean overlap flags.
 * @param validDetails - Kunye/details of compared theses.
 * @param log - Logger instance.
 * @returns Originality result details including risk badge, mapped overlap table, and risk percentage.
 */
export function calculateOriginalityRisk(
  overlapTable: Array<{
    id: number;
    academic_reasoning: string;
    is_research_question_overlapping: boolean;
    is_methodology_overlapping: boolean;
    is_theory_overlapping: boolean;
    is_context_overlapping: boolean;
  }>,
  validDetails: TezaraThesisDetails[],
  log: Logger,
): CalculatedOriginalityRiskResult {
  if (validDetails.length === 0 || overlapTable.length === 0) {
    log.info("flow_complete", {
      service: "originality",
      step: "analyze",
      data: {
        originalityBadge: "ZERO_RISK",
        riskPercentage: 0,
        thesisCount: 0,
      },
    });

    return {
      originalityBadge: "ZERO_RISK",
      overlapTable: [],
      riskPercentage: 0,
    };
  }

  const calculatedOverlapTable = overlapTable.map((item) => {
    const detail = validDetails.find((d) => d.id === item.id);
    if (!detail) {
      throw new Error(`Kaba elemeden gelen tez detayı bulunamadı: ${item.id}`);
    }

    const {
      is_research_question_overlapping,
      is_methodology_overlapping,
      is_theory_overlapping,
      is_context_overlapping = false,
    } = item;

    // Ağırlıklı Puanlama:
    // - Araştırma Nesnesi/Konu Kesişmesi = 40 puan
    // - Tarihsel Dönem Kesişmesi = 30 puan
    // - Metodoloji/Arşiv Kesişmesi = 20 puan
    // - Kuramsal Çerçeve Ortaklığı = 10 puan
    let calculated_score = 0;
    if (is_research_question_overlapping) calculated_score += 40;
    if (is_context_overlapping) calculated_score += 30;
    if (is_methodology_overlapping) calculated_score += 20;
    if (is_theory_overlapping) calculated_score += 10;

    let originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
    if (calculated_score >= 71) {
      originalityLevel = "HIGH_RISK";
    } else if (calculated_score <= 31) {
      originalityLevel = "LOW_RISK";
    } else {
      originalityLevel = "MEDIUM_RISK";
    }

    return {
      id: detail.id,
      title: detail.title,
      author: detail.author,
      university: detail.university,
      year: detail.year,
      thesisType: detail.thesisType,
      department: detail.department,
      comparisonNote: item.academic_reasoning,
      axes: {
        subject: (is_research_question_overlapping
          ? "OVERLAPPING"
          : "ORIGINAL") as "OVERLAPPING" | "ORIGINAL",
        theory: (is_theory_overlapping ? "OVERLAPPING" : "ORIGINAL") as
          | "OVERLAPPING"
          | "ORIGINAL",
        methodology: (is_methodology_overlapping
          ? "OVERLAPPING"
          : "ORIGINAL") as "OVERLAPPING" | "ORIGINAL",
        context: (is_context_overlapping ? "OVERLAPPING" : "ORIGINAL") as
          | "OVERLAPPING"
          | "ORIGINAL",
      },
      originalityLevel,
      calculated_score,
    };
  });

  const maxScore = Math.max(
    ...calculatedOverlapTable.map((item) => item.calculated_score),
  );
  const riskPercentage = maxScore;

  let originalityBadge: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
  if (
    calculatedOverlapTable.some((item) => item.originalityLevel === "HIGH_RISK")
  ) {
    originalityBadge = "HIGH_RISK";
  } else if (
    calculatedOverlapTable.some(
      (item) => item.originalityLevel === "MEDIUM_RISK",
    )
  ) {
    originalityBadge = "MEDIUM_RISK";
  } else if (
    calculatedOverlapTable.some((item) => item.originalityLevel === "LOW_RISK")
  ) {
    originalityBadge = "LOW_RISK";
  } else {
    originalityBadge = "ZERO_RISK";
  }

  log.info("flow_complete", {
    service: "originality",
    step: "analyze",
    data: {
      originalityBadge,
      riskPercentage,
      thesisCount: calculatedOverlapTable.length,
    },
  });

  return {
    originalityBadge,
    overlapTable: calculatedOverlapTable,
    riskPercentage,
  };
}

/**
 * Computes a sort priority integer for a thesis based on its 4-axis overlap profile.
 * Lower numbers indicate higher academic risk and should appear first in the UI table.
 * This is a pure function with no side effects.
 *
 * Priority 1 = all 4 axes overlapping (highest risk)
 * Priority 16 = all 4 axes original (no overlap)
 *
 * @param axes - The axis overlap flags for the thesis.
 * @returns A priority integer between 1 and 16.
 */
export function getThesisPriority(axes: {
  subject: string;
  theory: string;
  methodology: string;
  context?: string;
}): number {
  const {
    subject: s,
    theory: t,
    methodology: m,
    context: c = "ORIGINAL",
  } = axes;

  // 4 overlaps
  if (
    s === "OVERLAPPING" &&
    t === "OVERLAPPING" &&
    m === "OVERLAPPING" &&
    c === "OVERLAPPING"
  )
    return 1;

  // 3 overlaps
  if (
    s === "OVERLAPPING" &&
    t === "OVERLAPPING" &&
    m === "OVERLAPPING" &&
    c === "ORIGINAL"
  )
    return 2;
  if (
    s === "OVERLAPPING" &&
    t === "OVERLAPPING" &&
    m === "ORIGINAL" &&
    c === "OVERLAPPING"
  )
    return 3;
  if (
    s === "OVERLAPPING" &&
    t === "ORIGINAL" &&
    m === "OVERLAPPING" &&
    c === "OVERLAPPING"
  )
    return 4;
  if (
    s === "ORIGINAL" &&
    t === "OVERLAPPING" &&
    m === "OVERLAPPING" &&
    c === "OVERLAPPING"
  )
    return 5;

  // 2 overlaps (subject overlapping)
  if (
    s === "OVERLAPPING" &&
    t === "OVERLAPPING" &&
    m === "ORIGINAL" &&
    c === "ORIGINAL"
  )
    return 6;
  if (
    s === "OVERLAPPING" &&
    t === "ORIGINAL" &&
    m === "ORIGINAL" &&
    c === "OVERLAPPING"
  )
    return 7;
  if (
    s === "OVERLAPPING" &&
    t === "ORIGINAL" &&
    m === "OVERLAPPING" &&
    c === "ORIGINAL"
  )
    return 8;

  // 1 overlap (subject overlapping)
  if (
    s === "OVERLAPPING" &&
    t === "ORIGINAL" &&
    m === "ORIGINAL" &&
    c === "ORIGINAL"
  )
    return 9;

  // 2 overlaps (subject original)
  if (
    s === "ORIGINAL" &&
    t === "ORIGINAL" &&
    m === "OVERLAPPING" &&
    c === "OVERLAPPING"
  )
    return 10;
  if (
    s === "ORIGINAL" &&
    t === "OVERLAPPING" &&
    m === "ORIGINAL" &&
    c === "OVERLAPPING"
  )
    return 11;
  if (
    s === "ORIGINAL" &&
    t === "OVERLAPPING" &&
    m === "OVERLAPPING" &&
    c === "ORIGINAL"
  )
    return 12;

  // 1 overlap (subject original)
  if (
    s === "ORIGINAL" &&
    t === "ORIGINAL" &&
    m === "ORIGINAL" &&
    c === "OVERLAPPING"
  )
    return 13;
  if (
    s === "ORIGINAL" &&
    t === "ORIGINAL" &&
    m === "OVERLAPPING" &&
    c === "ORIGINAL"
  )
    return 14;
  if (
    s === "ORIGINAL" &&
    t === "OVERLAPPING" &&
    m === "ORIGINAL" &&
    c === "ORIGINAL"
  )
    return 15;

  // 0 overlaps
  return 16;
}
