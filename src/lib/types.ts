import { z } from "zod";

/**
 * Deterministik karar motorunun her aday tez için üretebileceği rozet değerleri.
 * Birden fazla rozet aynı anda taşınabilir (badges[]); birincil rozet primaryBadge'de
 * belirlenir.
 */
export type AnalysisBadge =
  | "CRITICAL_OVERLAP" // Sav, odak ve aktör kilitlenmesi (En üst risk seviyesi)
  | "APPROACH_DIVERGENCE" // Odak ve aktör çakışıyor ancak teori veya metot farklı (Kurtarılabilir)
  | "DIALECTICAL_OPPORTUNITY" // Akademik Antitez (Katkı)
  | "LITERATURE_BRIDGE" // Literatür Köprüsü (Katkı)
  | "THEMATIC_SYNTHESIS" // Tematik Sentez (Katkı)
  | "IRRELEVANT_DATA"; // Bağlam Dışı (Gürültü)

export type RelationshipBadge =
  | "HIGH_RISK" // En az bir tez CRITICAL_OVERLAP rozeti almış
  | "SALVAGEABLE" // En yüksek risk seviyesi APPROACH_DIVERGENCE rozeti
  | "CONTRIBUTION" // Sadece aktif katkı/fırsat rozetleri mevcut
  | "UNRELATED"; // Hiçbir aktif tez yok veya tümü elenmiş/bağlam dışı

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
      /** LLM'in maksimum 2 cümlelik somut eylem plani */
      analysisNote: string;
      yokPdfUrl?: string;
      title: string;
      author: string;
      university: string;
      year: number;
      thesisType: string;
      department: string;
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
      analysisNote: string;
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
  analysisNote: z.string(),
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
  analysisNote: string;
  yokPdfUrl?: string;
}

export interface GeminiThesisBox {
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
  articles: JuryArticle[];
}
