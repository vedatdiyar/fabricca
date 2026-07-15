import { z } from "zod";

/**
 * Deterministic decision engine badge values.
 *
 * Stage 1 (Mutlak Özgünlük Kontrolü):
 *   DUPLICATE_THESIS_RISK — All 7 dimensions scored 100 (identical clone)
 *
 * Stage 2 (Akademik Katkı / Yararlanma Alanları):
 *   Badges #1-#9 are checked in strict priority order; first match wins.
 *   Gatekeeper: RF>0 & MA>0 or IRRELEVANT_DATA.
 */
export type AnalysisBadge =
  | "DUPLICATE_THESIS_RISK" // Stage 1 — RISK bucket
  | "EMPIRICAL_FOUNDATION_SOURCE" // Stage 2 #1 — CONTRIBUTION
  | "DIALECTICAL_DISCUSSION_SUPPORT" // Stage 2 #2 — CONTRIBUTION
  | "THEMATIC_SYNTHESIS_OPPORTUNITY" // Stage 2 #3 — CONTRIBUTION
  | "CROSS_CONTEXTUAL_VALIDATION" // Stage 2 #4 — CONTRIBUTION
  | "METHODOLOGICAL_AND_THEORETICAL_PEER" // Stage 2 #5 — CONTRIBUTION
  | "HISTORICAL_BASELINE_DATA" // Stage 2 #6 — CONTRIBUTION
  | "FUTURE_PROSPECTIVE_CONTEXT" // Stage 2 #7 — CONTRIBUTION
  | "MACRO_STRUCTURAL_CONTEXT" // Stage 2 #8 — CONTRIBUTION
  | "PARALLEL_LITERATURE_REFERENCE" // Stage 2 #9 — CONTRIBUTION
  | "IRRELEVANT_DATA"; // Stage 2 gatekeeper fail — IRRELEVANT

export type RelationshipBadge =
  | "HIGH_RISK" // At least one DUPLICATE_THESIS_RISK exists
  | "CONTRIBUTION_READY" // No duplicates, at least one CONTRIBUTION badge
  | "UNRELATED"; // All theses are IRRELEVANT_DATA or empty pool

export type OnboardingActionResult =
  | { success: true; isProcessing?: boolean; error?: never }
  | { success?: never; error: string };

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
  language?: string;
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

/**
 * Özgünlük raporu verisi.
 */
export interface OriginalityReportData {
  tezaraResults: {
    relationshipBadge: RelationshipBadge;
    overlapTable: {
      id: number;
      /** Birincil karar rozeti — kadrın rengi ve ikonunu belirler */
      primaryBadge: AnalysisBadge;
      /** Tüm aktif rozetler (donör bayrakları dahil) */
      badges: AnalysisBadge[];
      yokPdfUrl?: string;
      abstract?: string;
      title: string;
      author: string;
      university: string;
      year: number;
      thesisType: string;
      department: string;
      /** Bileşik benzerlik skoru (7 boyut toplamı, 0-700 aralığı) */
      relevanceScore: number;
    }[];
    /** Gemini analizinden geçip elenen (NOISE) tezler */
    eliminatedTheses: {
      id: number;
      title: string;
      author: string;
      university: string;
      year: number;
      thesisType: string;
      department: string;
      yokPdfUrl?: string;
      primaryBadge: AnalysisBadge;
      badges: AnalysisBadge[];
      eliminationStage: "ANALYSIS";
    }[];
  };
}

/**
 * Tez matrisinin 7 temel alanını tanımlayan kanonik tip.
 * Prompt builder'lar, servis katmanları ve onboarding akışı
 * tarafından ortak kullanılır.
 */
export interface ThesisMatrix {
  mainActors: string;
  researchFocus: string;
  temporalScope: string;
  spatialScope: string;
  theoreticalFramework: string;
  methodology: string;
  mainClaim: string;
}

/**
 * YÖKTEZ ve sifting sonucunda elenen ve seçilen tez nesneleri.
 */
export interface ScrapedTheses {
  selected: TezaraThesisDetails[];
  eliminated: TezaraThesisSummary[];
}

export interface FoundationalQuery {
  author: string;
  title: string;
  publicationYear: number;
  doi?: string | null;
  publisher?: string | null;
}

export const FoundationalQuerySchema = z.object({
  author: z.string().min(1, "Yazar adı boş olamaz"),
  title: z.preprocess(
    (v) =>
      typeof v === "string" && v.trim().length === 0 ? "İsimsiz Kaynak" : v,
    z.string().min(1, "Eser başlığı boş olamaz"),
  ),
  publicationYear: z.coerce.number().int().min(0, "Yayın yılı geçersiz"),
  doi: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
});

export const RelatedThesisEntrySchema = z.object({
  title: z.string().min(1, "Tez başlığı boş olamaz"),
  author: z.string().min(1, "Yazar adı boş olamaz"),
  university: z.string(),
  year: z.number().int(),
  thesisType: z.string(),
  department: z.string(),
  primaryBadge: z.string(),
  badges: z.array(z.string()),
  yokPdfUrl: z.string().optional(),
});

export interface RelatedThesisEntry {
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  primaryBadge: AnalysisBadge;
  badges: AnalysisBadge[];
  yokPdfUrl?: string;
}

export interface GeminiThesisBox {
  /** DB id — populated when loaded from the database, undefined for Gemini-generated raw output */
  id?: number;
  title: string;
  boxType:
    | "PROBLEMATIZATION"
    | "CONCEPTUAL"
    | "DATA_PROTOCOL"
    | "PRIMARY_MATERIAL"
    | "CONTEXT"
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
  comparisonNote: string | null;
  badge: string | null;
  url: string;
  doi: string | null;
  publisher: string | null;
  publicationYear: number | null;
  authors: string[];
  isFoundational: boolean;
  relevanceScore: number;
  subBoxId?: string;
}

export interface LiteraturePoolEntry {
  subBoxTitle: string;
  thesisBoxId: number;
  articles: JuryArticle[];
}
