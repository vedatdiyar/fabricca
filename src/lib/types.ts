import { z } from "zod";
import type { ThesisBadge as ThesisBadgeOrig } from "@/lib/academic/badge-calculator";
export type ThesisBadge = ThesisBadgeOrig;

export type OnboardingActionResult =
  | { success: true; isProcessing?: boolean; error?: never }
  | { success?: never; error: string };

export type OverlapLevel = "KRITIK" | "ORTA" | "OZGUN";

export type AxesOption = "BIREBIR" | "KAPSAYAN" | "TEGET" | "ALAKASIZ";

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
  positioning: AxesOption;
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

export interface OriginalityReportData {
  tavilyResults: {
    items: TavilyEvaluationFact[];
    briefingNote: string;
  };
  tezaraResults: {
    originalityBadge: ThesisBadge;
    overlapTable: {
      id: number;
      axes: {
        subject: OverlapLevel;
        theory: OverlapLevel;
        methodology: OverlapLevel;
        context?: OverlapLevel;
      };
      comparisonNote?: string;
      yokPdfUrl?: string;
      title: string;
      author: string;
      university: string;
      year: number;
      thesisType: string;
      department: string;
    }[];
    strategicRecommendations: string;
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
  "matrix" | "risk" | "boxes" | "literature-review" | "completed";

/**
 * Onboarding sürecinin ilk adımındaki tez matrisi form verileri.
 */
export interface OnboardingFormData {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  mainClaim: string;
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
  axes: {
    subject: OverlapLevel;
    theory: OverlapLevel;
    methodology: OverlapLevel;
    context?: OverlapLevel;
  };
  comparisonNote?: string;
  yokPdfUrl?: string;
}

export interface FoundationalQuery {
  author: string;
  title: string;
  publicationYear: number;
}

export const FoundationalQuerySchema = z.object({
  author: z.string().min(1, "Yazar adı boş olamaz"),
  title: z.string().min(1, "Eser başlığı boş olamaz"),
  publicationYear: z.coerce.number().int().min(0, "Yayın yılı geçersiz"),
});

export const RefinedFoundationalQueriesSchema = z.object({
  foundationalQueries: z.array(FoundationalQuerySchema).max(4),
});

export const RelatedThesisEntrySchema = z.object({
  title: z.string().min(1, "Tez başlığı boş olamaz"),
  author: z.string().min(1, "Yazar adı boş olamaz"),
  university: z.string(),
  year: z.number().int(),
  thesisType: z.string(),
  department: z.string(),
  axes: z.object({
    subject: z.enum(["KRITIK", "ORTA", "OZGUN"]),
    theory: z.enum(["KRITIK", "ORTA", "OZGUN"]),
    methodology: z.enum(["KRITIK", "ORTA", "OZGUN"]),
    context: z.enum(["KRITIK", "ORTA", "OZGUN"]).optional(),
  }),
  comparisonNote: z.string().optional(),
  yokPdfUrl: z.string().optional(),
});

export const GeminiThesisBoxSchema = z.object({
  title: z.string().min(1, "Kutu başlığı boş olamaz"),
  boxType: z.enum([
    "PROBLEMATIZATION",
    "CONCEPTUAL",
    "DATA_PROTOCOL",
    "PRIMARY_MATERIAL",
    "RELATED_THESES",
  ]),
  description: z.string().min(1, "Kutu açıklaması boş olamaz"),
  parentId: z.number().nullable().optional(),
  semanticQuery: z.string().nullable().optional(),
  get subBoxes() {
    return z.array(GeminiThesisBoxSchema).optional();
  },
  foundationalQueries: z.array(FoundationalQuerySchema).max(12).optional(),
  concepts: z.array(z.string()).max(6).optional(),
  relatedTheses: z.array(RelatedThesisEntrySchema).optional(),
});

export const FinalGeminiThesisBoxSchema = GeminiThesisBoxSchema;

export const FinalBoxGenerationResponseSchema = z.object({
  boxes: z
    .array(FinalGeminiThesisBoxSchema)
    .min(1, "En az bir kutu üretilmelidir"),
});

/**
 * Özgünlük analizinde tespit edilen sınırdaş/ikiz tez çalışması.
 */
export interface RelatedThesisEntry {
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  axes: {
    subject: OverlapLevel;
    theory: OverlapLevel;
    methodology: OverlapLevel;
    context?: OverlapLevel;
  };
  comparisonNote?: string;
  yokPdfUrl?: string;
}

export interface GeminiThesisBox {
  title: string;
  boxType:
    | "PROBLEMATIZATION"
    | "CONCEPTUAL"
    | "DATA_PROTOCOL"
    | "PRIMARY_MATERIAL"
    | "RELATED_THESES";
  description: string;
  parentId: number | null;
  semanticQuery: string | null;
  subBoxes?: GeminiThesisBox[];
  foundationalQueries?: FoundationalQuery[];
  concepts?: string[];
  relatedTheses?: RelatedThesisEntry[];
}

export interface JuryArticle {
  title: string;
  abstract: string;
  url: string;
  doi: string | null;
  publisher: string;
  publicationYear: number;
  authors: string[];
  isFoundational: boolean;
  relevanceScore: number;
  subBoxId?: string;
}

export interface LiteraturePoolEntry {
  subBoxTitle: string;
  articles: JuryArticle[];
}
