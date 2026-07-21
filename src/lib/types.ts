import { z } from "zod";

export type TemporalLabel = "OVERLAP" | "PAST" | "FUTURE" | "UNKNOWN";

export type DimensionLevel = "LOW" | "MEDIUM" | "HIGH";

export type AcademicBadge =
  "SAFE_ORIGINAL" | "RELATED_THESIS" | "HIGH_RISK_REPLICATION";

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
  language?: string;
}

export interface OriginalityReportData {
  tezaraResults: {
    relationshipBadge: RelationshipBadge;
    overlapTable: {
      id: number;
      title: string;
      author: string;
      university: string;
      year: number;
      thesisType: string;
      department: string;
      yokPdfUrl?: string;
      abstract?: string;
      isRelevant: boolean;
      relevanceExplanation: string;
      originalityStatus: AcademicBadge;
      uniquenessGap: string;
      replicationWarning: string;
      literatureReviewUsage: string;
      chapterIntegration: string;
      conceptualBorrowing: string;
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
      abstract?: string;
      isRelevant: boolean;
      relevanceExplanation: string;
      originalityStatus: AcademicBadge;
      uniquenessGap: string;
      replicationWarning: string;
      literatureReviewUsage: string;
      chapterIntegration: string;
      conceptualBorrowing: string;
      eliminationStage: "ANALYSIS";
    }[];
  };
}

export interface ThesisMatrix {
  researchCore: string;
  targetActors: string;
  context: string;
  framework: string;
  mainClaim: string;
}

export interface ScrapedTheses {
  selected: TezaraThesisDetails[];
  eliminated: TezaraThesisDetails[];
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
  originalityStatus: z.string(),
  yokPdfUrl: z.string().optional(),
});

export interface RelatedThesisEntry {
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  originalityStatus: AcademicBadge;
  yokPdfUrl?: string;
}

export interface GeminiThesisBox {
  id?: number;
  parentId: number | null;
  boxType:
    | "PROBLEMATIZATION"
    | "CONCEPTUAL"
    | "DATA_PROTOCOL"
    | "PRIMARY_MATERIAL"
    | "CONTEXT"
    | "RELATED_THESES";
  title: string;
  description: string;
  semanticQuery: string | null;
  subBoxes?: GeminiThesisBox[];
  foundationalQueries?: FoundationalQuery[];
  concepts?: string[];
  relatedTheses?: RelatedThesisEntry[];
}

export interface JuryArticle {
  title: string;
  authors: string[];
  publisher: string | null;
  publicationYear: number | null;
  doi: string | null;
  url: string;
  relevanceScore: number;
  badge: string | null;
  comparisonNote: string | null;
  isFoundational: boolean;
  subBoxId?: string;
}

export interface LiteraturePoolEntry {
  subBoxTitle: string;
  thesisBoxId: number;
  articles: JuryArticle[];
}
