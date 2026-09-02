import type { ThesisBoxType } from "./box-constants";

export type OnboardingActionResult =
  | { success: true; isProcessing?: boolean; error?: never }
  | {
      success: false;
      error: string;
      code?: string;
      quotaType?: "RPM" | "RPD" | "CONCURRENCY";
      retryAfterMs?: number;
      resetsAt?: string;
      meta?: Record<string, unknown>;
    }
  | {
      success?: never;
      error: string;
      code?: string;
      quotaType?: "RPM" | "RPD" | "CONCURRENCY";
      retryAfterMs?: number;
      resetsAt?: string;
      meta?: Record<string, unknown>;
    };

export interface ThesisSummary {
  id: number;
  title: string;
  author: string;
  university: string;
  year: number;
  thesisType: string;
  department: string;
  language?: string;
}

export interface ThesisDetails {
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
  subjectProblem: string;
  theoreticalFramework: string;
  primaryMaterial: string;
  methodology: string;
}

export interface GeminiThesisBox {
  id?: number;
  parentId: number | null;
  boxType: ThesisBoxType;
  title: string;
  description: string;
  semanticQuery: string | null;
  subBoxes?: GeminiThesisBox[];
  concepts?: string[];
}

export interface JuryArticle {
  title: string;
  authors: string[];
  publisher: string | null;
  thesisType?: string | null;
  publicationYear: number | null;
  doi: string | null;
  openalexId: string | null;
  relevanceScore: number;
  comparisonNote: string | null;
  abstract?: string | null;
  subBoxId?: string;
}

export type LiteraturePoolEntryStatus = "manual_entry_required";

export interface LiteraturePoolEntry {
  subBoxTitle: string;
  thesisBoxId: number;
  articles: JuryArticle[];
  status?: LiteraturePoolEntryStatus;
}
