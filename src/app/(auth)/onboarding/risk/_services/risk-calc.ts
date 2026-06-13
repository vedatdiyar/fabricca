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
  academic_reasoning: string;
  is_research_question_overlapping: boolean;
  is_methodology_overlapping: boolean;
  is_theory_overlapping: boolean;
  calculated_score: number;
  badge: "LOW" | "MEDIUM" | "HIGH";
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
    } = item;
    const trueCount = [
      is_research_question_overlapping,
      is_methodology_overlapping,
      is_theory_overlapping,
    ].filter(Boolean).length;

    let calculated_score: number;
    let badge: "LOW" | "MEDIUM" | "HIGH";

    if (
      is_research_question_overlapping &&
      is_methodology_overlapping &&
      is_theory_overlapping
    ) {
      calculated_score = 100;
      badge = "HIGH";
    } else if (
      (is_research_question_overlapping && is_methodology_overlapping) ||
      trueCount >= 2
    ) {
      calculated_score = 50;
      badge = "MEDIUM";
    } else {
      calculated_score = 15;
      badge = "LOW";
    }

    return {
      id: detail.id,
      title: detail.title,
      author: detail.author,
      university: detail.university,
      year: detail.year,
      thesisType: detail.thesisType,
      department: detail.department,
      academic_reasoning: item.academic_reasoning,
      is_research_question_overlapping,
      is_methodology_overlapping,
      is_theory_overlapping,
      calculated_score,
      badge,
    };
  });

  const maxScore = Math.max(
    ...calculatedOverlapTable.map((item) => item.calculated_score),
  );
  const riskPercentage = maxScore;

  let originalityBadge: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
  if (riskPercentage === 100) {
    originalityBadge = "HIGH_RISK";
  } else if (riskPercentage === 50) {
    originalityBadge = "MEDIUM_RISK";
  } else if (riskPercentage === 15) {
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
