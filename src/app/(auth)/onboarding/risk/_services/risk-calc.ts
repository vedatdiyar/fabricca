import type { Logger } from "@/lib/logger";
import type { TezaraThesisDetails, AxesOption, OverlapItem } from "@/lib/types";

export interface CalculatedOverlapItem {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  axes: {
    subject: AxesOption;
    theory: AxesOption;
    methodology: AxesOption;
    context: AxesOption;
  };
  originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
  comparisonNote?: string;
}

export interface CalculatedOriginalityRiskResult {
  originalityBadge: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
  overlapTable: CalculatedOverlapItem[];
  riskPercentage: number;
}

/**
 * Calculates originality risk level and formats the output structure.
 *
 * @param overlapTable - The structured overlap table from Gemini analysis.
 * @param validDetails - The retrieved details of compared theses.
 * @param log - Logger instance.
 * @returns Originality result details including badge, overlapTable, and riskPercentage.
 */
export function calculateOriginalityRisk(
  overlapTable: OverlapItem[],
  validDetails: TezaraThesisDetails[],
  log: Logger,
): CalculatedOriginalityRiskResult {
  if (validDetails.length === 0) {
    const defaultResult: CalculatedOriginalityRiskResult = {
      originalityBadge: "ZERO_RISK" as const,
      overlapTable: [],
      riskPercentage: 0,
    };

    log.info("flow_complete", {
      service: "originality",
      step: "analyze",
      data: { result: "ZERO_RISK", reason: "Hiçbir tez detayı çekilemedi" },
    });

    return defaultResult;
  }

  const calculatedOverlapTable = overlapTable.map((item) => {
    const detail = validDetails.find((d) => d.id === item.id);
    if (!detail) {
      throw new Error(`Kaba elemeden gelen tez detayı bulunamadı: ${item.id}`);
    }

    const { subject, theory, methodology, context } = item.axes;
    let originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";

    const overlapCount = [
      subject === "OVERLAPPING",
      theory === "OVERLAPPING",
      methodology === "OVERLAPPING",
      context === "OVERLAPPING",
    ].filter(Boolean).length;

    // 1. Yüksek Risk Koşulları: Konu ve Teori çakışırken, metot veya bağlamdan en az biri de çakışıyorsa (Durum 14, 15, 16)
    if (
      subject === "OVERLAPPING" &&
      theory === "OVERLAPPING" &&
      (methodology === "OVERLAPPING" || context === "OVERLAPPING")
    ) {
      originalityLevel = "HIGH_RISK";
    }
    // 2. Orta Risk Koşulları: Tam olarak 3 eksen çakışıyor ve Konu ya da Teori'den biri özgünse (Durum 12, 13)
    else if (
      overlapCount === 3 &&
      (subject === "ORIGINAL" || theory === "ORIGINAL")
    ) {
      originalityLevel = "MEDIUM_RISK";
    }
    // 3. Düşük Risk Koşulları: Diğer tüm kombinasyonlar (Geri kalan 11 durum)
    else {
      originalityLevel = "LOW_RISK";
    }

    return {
      id: detail.id,
      title: detail.title,
      author: detail.author,
      university: detail.university,
      year: detail.year,
      thesisType: detail.thesisType,
      department: detail.department,
      axes: item.axes,
      originalityLevel,
      comparisonNote: item.comparisonNote,
    };
  });

  // AŞAMA 7: Matematiksel Risk Puanı Formülü Entegrasyonu
  const totalAxesCount = 4 * validDetails.length;
  const overlappingAxesCount = overlapTable.reduce((sum, item) => {
    const { subject, theory, methodology, context } = item.axes;
    const count = [
      subject === "OVERLAPPING",
      theory === "OVERLAPPING",
      methodology === "OVERLAPPING",
      context === "OVERLAPPING",
    ].filter(Boolean).length;
    return sum + count;
  }, 0);

  const riskPercentage =
    totalAxesCount > 0
      ? Math.round((overlappingAxesCount / totalAxesCount) * 100)
      : 0;

  // Rozet ve UI Karar Matrisi
  let originalityBadge: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
  if (riskPercentage === 0) {
    originalityBadge = "ZERO_RISK";
  } else if (riskPercentage <= 25) {
    originalityBadge = "LOW_RISK";
  } else if (riskPercentage <= 50) {
    originalityBadge = "MEDIUM_RISK";
  } else {
    originalityBadge = "HIGH_RISK";
  }

  const result: CalculatedOriginalityRiskResult = {
    originalityBadge,
    overlapTable: calculatedOverlapTable,
    riskPercentage,
  };

  log.info("flow_complete", {
    service: "originality",
    step: "analyze",
    data: {
      originalityBadge,
      riskPercentage,
      thesisCount: calculatedOverlapTable.length,
    },
  });

  return result;
}
