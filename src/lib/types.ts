import { z } from "zod";

export type TemporalLabel = "OVERLAP" | "PAST" | "FUTURE" | "UNKNOWN";

export interface ThesisParams {
  researchFocus: 0 | 50 | 100;
  mainActors: 0 | 50 | 100;
  scopeContext: 0 | 50 | 100;
  temporalLabel: TemporalLabel;
  theoreticalFramework: 0 | 50 | 100;
  methodology: 0 | 50 | 100;
  mainClaim: 0 | 50 | 100;
}

export type DimensionLevel = "LOW" | "MEDIUM" | "HIGH";

export interface DimensionScores {
  content: DimensionLevel;
  methodTheory: DimensionLevel;
  context: DimensionLevel;
}

export type AcademicBadge =
  | "IRRELEVANT_DATA"
  | "TWIN_THESIS_ALERT"
  | "CRITICAL_REPLICATION_ALERT"
  | "METHODOLOGY_REFERENCE"
  | "THEORETICAL_ANCHOR"
  | "HISTORICAL_CONTEXT"
  | "FUTURE_PROJECTION"
  | "CONTEXTUAL_COMPARISON"
  | "EMPIRICAL_BENCHMARK"
  | "BACKGROUND_LITERATURE";

export type RelationshipBadge =
  "HIGH_RISK" | "CONTRIBUTION_READY" | "UNRELATED";

export type ThesisBucket = "RISK" | "CONTRIBUTION" | "IRRELEVANT";

export type OnboardingActionResult =
  | { success: true; isProcessing?: boolean; error?: never }
  | { success?: never; error: string };

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

export interface OriginalityReportData {
  tezaraResults: {
    relationshipBadge: RelationshipBadge;
    overlapTable: {
      id: number;
      primaryBadge: AcademicBadge;
      badges: AcademicBadge[];
      yokPdfUrl?: string;
      abstract?: string;
      title: string;
      author: string;
      university: string;
      year: number;
      thesisType: string;
      department: string;
      relevanceScore: number;
      dimensionScores?: {
        researchFocus: number;
        mainActors: number;
        scopeContext: number;
        temporalLabel: string;
        theoreticalFramework: number;
        methodology: number;
        mainClaim: number;
      };
    }[];
    eliminatedTheses: {
      id: number;
      title: string;
      author: string;
      university: string;
      year: number;
      thesisType: string;
      department: string;
      yokPdfUrl?: string;
      primaryBadge: AcademicBadge;
      badges: AcademicBadge[];
      eliminationStage: "ANALYSIS";
      relevanceScore: number;
      dimensionScores?: {
        researchFocus: number;
        mainActors: number;
        scopeContext: number;
        temporalLabel: string;
        theoreticalFramework: number;
        methodology: number;
        mainClaim: number;
      };
    }[];
  };
}

export interface ThesisMatrix {
  mainActors: string;
  researchFocus: string;
  context: string;
  theoreticalFramework: string;
  methodology: string;
  mainClaim: string;
}

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
  primaryBadge: AcademicBadge;
  badges: AcademicBadge[];
  yokPdfUrl?: string;
}

export interface GeminiThesisBox {
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
