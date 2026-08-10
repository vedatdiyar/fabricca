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
  subjectProblem: string;
  theoreticalFramework: string;
  primaryMaterial: string;
  methodology: string;
}

export interface GeminiThesisBox {
  id?: number;
  parentId: number | null;
  boxType:
    | "SUBJECT_PROBLEM"
    | "THEORETICAL_FRAMEWORK"
    | "PRIMARY_MATERIAL"
    | "METHODOLOGY"
    | "RELATED_THESES";
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
  isFoundational: boolean;
  subBoxId?: string;
}

export interface LiteraturePoolEntry {
  subBoxTitle: string;
  thesisBoxId: number;
  articles: JuryArticle[];
}
