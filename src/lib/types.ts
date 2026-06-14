export type OnboardingActionResult =
  | { success: true; isProcessing?: boolean; error?: never }
  | { success?: never; error: string };

export type EnhancedThesisData = {
  academicStudyTitle: string;
  literatureResearchQuestion: string;
  refinedThesisClaim: string;
  conceptualTheoreticalInfrastructure: string;
  academicMethodologyDesign: string;
  historicalSpatialLimits: string;
};

export type EnhancedThesisActionResult =
  | { success: true; data: EnhancedThesisData; error?: never }
  | { success?: never; error: string };

export type AxesOption = "OVERLAPPING" | "ORIGINAL";

/**
 * Tezara tez arama sonucu özeti.
 * Listeleme sorgularından dönen kısa tez kaydını temsil eder.
 */
export interface TezaraThesisSummary {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
}

/**
 * Tezara tez detay kaydı.
 * Bireysel tez sayfasından çekilen tam içeriği temsil eder.
 */
export interface TezaraThesisDetails {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  abstract: string;
  yokPdfUrl?: string;
}

export interface QueryExtractionResponse {
  tavilyQueries: string[];
  keywords: string[];
}

export interface DeepSiftResponse {
  selectedThesisIds: number[];
}

export interface TavilyEvaluationFact {
  fact: string;
  result: "VERIFIED" | "PARTIALLY_VERIFIED" | "REFUTED";
  resultNote?: string;
  sourceUrl: string;
}

export interface TavilyEvaluationResponse {
  items: TavilyEvaluationFact[];
  briefingNote: string;
}

export interface OverlapItem {
  id: number;
  axes: {
    subject: AxesOption;
    theory: AxesOption;
    methodology: AxesOption;
    context?: AxesOption;
  };
  comparisonNote?: string;
  yokPdfUrl?: string;
}

export interface OriginalityReportData {
  tavilyResults: {
    items: TavilyEvaluationFact[];
    briefingNote: string;
  };
  tezaraResults: {
    originalityBadge: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
    overlapTable: (OverlapItem & {
      title: string;
      author: string;
      university: string;
      year: number;
      thesisType: string;
      department: string;
      originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
    })[];
    strategicRecommendations: string;
    riskPercentage?: number;
  };
}
