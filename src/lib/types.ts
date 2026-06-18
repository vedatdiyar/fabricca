import { z } from "zod";

export type OnboardingActionResult =
  | { success: true; isProcessing?: boolean; error?: never }
  | { success?: never; error: string };

export const EnhancedThesisDataSchema = z.object({
  academicStudyTitle: z.string().min(1, "Çalışma başlığı boş olamaz"),
  literatureResearchQuestion: z.string().min(1, "Araştırma sorusu boş olamaz"),
  refinedThesisClaim: z.string().min(1, "Temel iddia boş olamaz"),
  conceptualTheoreticalInfrastructure: z
    .string()
    .min(1, "Kuramsal altyapı boş olamaz"),
  academicMethodologyDesign: z
    .string()
    .min(1, "Metodoloji tasarımı boş olamaz"),
  dataStrategy: z.string().min(1, "Veri stratejisi boş olamaz"),
  historicalLimits: z.string().min(1, "Tarihsel sınırlar boş olamaz"),
  spatialLimits: z.string().min(1, "Mekânsal sınırlar boş olamaz"),
  analyticalFocus: z.string().min(1, "Analitik odak boş olamaz"),
});

export type EnhancedThesisData = z.infer<typeof EnhancedThesisDataSchema>;

export type EnhancedThesisActionResult =
  | { success: true; data: EnhancedThesisData; error?: never }
  | { success?: never; error: string };

export type AxesOption = "HIGH" | "PARTIAL" | "NONE";

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

export interface DeepSiftEntry {
  id: number;
  positioning: "HIGH" | "PARTIAL" | "NONE";
}

export interface DeepSiftResponse {
  selectedTheses: DeepSiftEntry[];
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
  originalityScore?: number;
  originalityBadge?: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
  overlapAnalysis?: OverlapItem[];
  synthesisRoadmap?: string;
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
      originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
    })[];
    strategicRecommendations: string;
    riskPercentage?: number;
  };
}

/**
 * Onboarding adımlarındaki yükleme durumunu temsil eden tip.
 */
export type StepStatus = "idle" | "loading" | "error" | "success";

/**
 * Onboarding sürecindeki aktif adım tipini temsil eden enum benzeri tip.
 */
export type OnboardingStep =
  | "matrix"
  | "enrichment"
  | "risk"
  | "boxes"
  | "literature-review"
  | "completed";

/**
 * Onboarding sürecinin ilk adımındaki tez matrisi form verileri.
 */
export interface OnboardingFormData {
  studyTitle: string;
  researchQuestion: string;
  mainClaim: string;
  theoreticalFramework: string;
  methodology: string;
  dataStrategy: string;
  historicalLimits: string;
  spatialLimits: string;
  analyticalFocus: string;
}

/**
 * YÖKTEZ ve sifting sonucunda elenen ve seçilen tez nesneleri.
 */
export interface ScrapedTheses {
  selected: TezaraThesisDetails[];
  eliminated: TezaraThesisSummary[];
}

/**
 * Jüri analizi tablosunda listelenen karşılaştırmalı tez verisi.
 */
export interface JuryReportItem {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  originalityLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "ZERO_RISK";
  axes: {
    subject: AxesOption;
    theory: AxesOption;
    methodology: AxesOption;
    context?: AxesOption;
  };
  comparisonNote?: string;
  yokPdfUrl?: string;
}

export interface FoundationalQuery {
  author: string;
  title: string;
  publicationYear: number;
}

export const GeminiThesisBoxSchema = z.object({
  title: z.string().min(1, "Kutu başlığı boş olamaz"),
  boxType: z.enum([
    "Kuram",
    "Literatür",
    "Bağlam",
    "Yöntem",
    "Veri",
    "Analiz",
    "Katkı",
  ]),
  description: z.string().min(1, "Kutu açıklaması boş olamaz"),
  semanticSearchBlock: z
    .string()
    .min(1, "Semantik arama bloğu boş olamaz")
    .max(2000),
  foundationalQueries: z
    .array(
      z.object({
        author: z.string().min(1),
        title: z.string().min(1),
        publicationYear: z.number().int().positive(),
      }),
    )
    .min(2)
    .max(2),
  concepts: z.array(z.string()).max(3),
  selfCorrectionJustification: z
    .string()
    .min(1, "Öz-denetim gerekçesi boş olamaz"),
});

export const BoxGenerationResponseSchema = z.object({
  boxes: z.array(GeminiThesisBoxSchema).min(1, "En az bir kutu üretilmelidir"),
});

export interface GeminiThesisBox {
  title: string;
  boxType:
    | "Kuram"
    | "Literatür"
    | "Bağlam"
    | "Yöntem"
    | "Veri"
    | "Analiz"
    | "Katkı";
  description: string;
  semanticSearchBlock: string;
  foundationalQueries: FoundationalQuery[];
  concepts: string[];
}

export interface JuryArticle {
  type: "PRIMARY" | "SECONDARY";
  title: string;
  abstract: string;
  url: string;
  doi: string;
  publisher: string;
  publicationYear: number;
  authors: string[];
  isFoundational?: boolean;
}

export interface LiteraturePoolEntry {
  subBoxTitle: string;
  starterPack: JuryArticle[];
  reservedPool: JuryArticle[];
}
