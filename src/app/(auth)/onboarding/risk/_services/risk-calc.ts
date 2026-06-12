import type { Logger } from "@/lib/logger";
import type {
  GeminiAnalysisResponse,
  TezaraThesisDetails,
  AxesOption,
} from "@/lib/types";

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
}

export interface CalculatedOriginalityResult {
  originalityBadge: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
  overlapTable: CalculatedOverlapItem[];
  strategicRecommendations: string;
}

/**
 * Calculates originality risk level and formats the output structure.
 *
 * @param geminiResult - The structured analysis result from Gemini.
 * @param validDetails - The retrieved details of compared theses.
 * @param log - Logger instance.
 * @returns Originality result details including badge, recommendations, and overlapTable.
 */
export function calculateOriginalityRisk(
  geminiResult: GeminiAnalysisResponse,
  validDetails: TezaraThesisDetails[],
  log: Logger,
): CalculatedOriginalityResult {
  if (validDetails.length === 0) {
    const defaultResult: CalculatedOriginalityResult = {
      originalityBadge: "ZERO_RISK" as const,
      overlapTable: [],
      strategicRecommendations:
        "Literatür taramasında doğrudan çakışan veya risk teşkil eden herhangi bir akademik çalışma tespit edilmemiştir. Araştırma tasarımınızın özgünlüğü maksimum seviyededir.",
    };

    log.info("flow_complete", {
      service: "originality",
      step: "analyze",
      data: { result: "ZERO_RISK", reason: "Hiçbir tez detayı çekilemedi" },
    });

    return defaultResult;
  }

  const overlapTable = geminiResult.overlapTable.map((item) => {
    const detail = validDetails.find((d) => d.id === item.id);
    if (!detail) {
      throw new Error(`Kaba elemeden gelen tez detayı bulunamadı: ${item.id}`);
    }

    const { subject, theory, methodology, context } = item.axes;
    let originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";

    // Mantıksal Kurallar (Matematiksel Puanlama Olmaksızın)
    // 1. Düşük Risk Koşulları: Teori veya Konu tamamen özgünse
    if (theory === "ORIGINAL" || subject === "ORIGINAL") {
      originalityLevel = "LOW_RISK";
    }
    // 2. Yüksek Risk Koşulları:
    // - Konu, Teori ve Bağlam aynı anda çakışıyorsa
    // - Veya Konu, Teori ve Metodoloji çakışıyorsa (Bağlam tamamen özgün olmadığı sürece)
    else if (
      (subject === "OVERLAPPING" &&
        theory === "OVERLAPPING" &&
        context === "OVERLAPPING") ||
      (subject === "OVERLAPPING" &&
        theory === "OVERLAPPING" &&
        methodology === "OVERLAPPING" &&
        context !== "ORIGINAL")
    ) {
      originalityLevel = "HIGH_RISK";
    }
    // 3. Orta Risk Koşulları: Diğer tüm kısmi benzerlik durumları
    else {
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
      axes: item.axes,
      originalityLevel,
    };
  });

  // Genel Sonuç Hiyerarşisi
  let originalityBadge: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
  if (overlapTable.some((item) => item.originalityLevel === "HIGH_RISK")) {
    originalityBadge = "HIGH_RISK";
  } else if (
    overlapTable.some((item) => item.originalityLevel === "MEDIUM_RISK")
  ) {
    originalityBadge = "MEDIUM_RISK";
  } else {
    originalityBadge = "LOW_RISK";
  }

  const result: CalculatedOriginalityResult = {
    originalityBadge,
    overlapTable,
    strategicRecommendations: geminiResult.strategicRecommendations,
  };

  log.info("flow_complete", {
    service: "originality",
    step: "analyze",
    data: { originalityBadge, thesisCount: overlapTable.length },
  });

  return result;
}
