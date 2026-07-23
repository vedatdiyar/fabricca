import { z } from "zod";

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

export interface ThesisMatrix {
  researchCore: string;
  targetActors: string;
  context: string;
  framework: string;
  mainClaim: string;
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
