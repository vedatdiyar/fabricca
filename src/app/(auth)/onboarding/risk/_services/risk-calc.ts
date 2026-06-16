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
    log.info({
      step: "calculate_originality_risk",
      status: "SUCCESS",
      metrics: {
        duration: "0.0s",
        outputRows: 0,
      },
      diagnostics: {
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

    const axisFlag = (v: boolean): "OVERLAPPING" | "ORIGINAL" =>
      v ? "OVERLAPPING" : "ORIGINAL";

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
        subject: axisFlag(is_research_question_overlapping),
        theory: axisFlag(is_theory_overlapping),
        methodology: axisFlag(is_methodology_overlapping),
        context: axisFlag(is_context_overlapping),
      },
      originalityLevel,
      calculated_score,
    };
  });

  const maxScore = Math.max(
    ...calculatedOverlapTable.map((item) => item.calculated_score),
  );
  const riskPercentage = maxScore;

  const levels = new Set(calculatedOverlapTable.map((i) => i.originalityLevel));
  const originalityBadge: CalculatedOriginalityRiskResult["originalityBadge"] =
    levels.has("HIGH_RISK") ? "HIGH_RISK"
      : levels.has("MEDIUM_RISK") ? "MEDIUM_RISK"
        : levels.has("LOW_RISK") ? "LOW_RISK"
          : "ZERO_RISK";

  log.info({
    step: "calculate_originality_risk",
    status: "SUCCESS",
    metrics: {
      duration: "0.0s",
      outputRows: calculatedOverlapTable.length,
    },
    diagnostics: {
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
 * Priority 1 = all 4 axes overlapping (highest risk).
 * Priority 16 = all 4 axes original (no overlap).
 *
 * Uses bit-mask encoding: subject=8, theory=4, methodology=2, context=1.
 *
 * @param axes - The axis overlap flags for the thesis.
 * @returns A priority integer between 1 and 16.
 */
const PRIORITY_MAP: Record<number, number> = {
  0b1111: 1, 0b1110: 2, 0b1101: 3, 0b1011: 4, 0b0111: 5,
  0b1100: 6, 0b1001: 7, 0b1010: 8,
  0b1000: 9,
  0b0011: 10, 0b0101: 11, 0b0110: 12,
  0b0001: 13, 0b0010: 14, 0b0100: 15,
  0b0000: 16,
};

export function getThesisPriority(axes: {
  subject: string;
  theory: string;
  methodology: string;
  context?: string;
}): number {
  const bits =
    (axes.subject === "OVERLAPPING" ? 8 : 0) |
    (axes.theory === "OVERLAPPING" ? 4 : 0) |
    (axes.methodology === "OVERLAPPING" ? 2 : 0) |
    ((axes.context ?? "ORIGINAL") === "OVERLAPPING" ? 1 : 0);

  return PRIORITY_MAP[bits] ?? 16;
}
