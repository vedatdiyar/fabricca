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

  // Kod Seviyesinde Risk Hesaplama
  const scoreMap: Record<"OVERLAPPING" | "PARTIAL" | "ORIGINAL", number> = {
    OVERLAPPING: 0,
    PARTIAL: 1,
    ORIGINAL: 2,
  };

  const overlapTable = geminiResult.overlapTable.map((item) => {
    const detail = validDetails.find((d) => d.id === item.id);
    if (!detail) {
      throw new Error(`Kaba elemeden gelen tez detayı bulunamadı: ${item.id}`);
    }

    const { subject, theory, methodology, context } = item.axes;
    let originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";

    // Teori Kuralı: Teori ekseni = Özgün ise diğer eksenler çakışsa bile doğrudan DÜŞÜK RİSK.
    if (theory === "ORIGINAL") {
      originalityLevel = "LOW_RISK";
    }
    // Bağlam İstisnası: Sadece Bağlam Özgün ise doğrudan ORTA RİSK.
    else if (
      context === "ORIGINAL" &&
      subject === "OVERLAPPING" &&
      theory === "OVERLAPPING" &&
      methodology === "OVERLAPPING"
    ) {
      originalityLevel = "MEDIUM_RISK";
    }
    // Skorlama Skalası (Toplam Puan)
    else {
      const totalScore =
        scoreMap[subject] +
        scoreMap[theory] +
        scoreMap[methodology] +
        scoreMap[context];

      if (totalScore <= 2) {
        originalityLevel = "HIGH_RISK";
      } else if (totalScore <= 5) {
        originalityLevel = "MEDIUM_RISK";
      } else {
        originalityLevel = "LOW_RISK";
      }
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
