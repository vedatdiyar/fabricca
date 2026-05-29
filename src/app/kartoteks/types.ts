import { InsightItem } from "./actions";

export interface ThesisBox {
  id: number;
  thesisCoreId: number;
  name: string;
  description: string | null;
  order: number;
  createdAt: Date | null;
}

export interface Note {
  id: number;
  referenceId: number | null;
  content: string;
  aiContextSuggestions: string | null;
  boxId: number | null;
  createdAt: Date | null;
  referenceTitle: string | null;
  referenceAuthors: string | null;
  referenceYear: number | null;
  mainArgument?: string | null;
  quotes?: string | null;
  concepts?: string | null;
  criticalNotes?: string | null;
  connections?: string | null;
  researchNotes?: string | null;
  memoryAnchors?: string | null;
}

export interface PageState {
  boxes: ThesisBox[];
  notes: Note[];
  isLoading: boolean;
  transferringNoteId: number | null;
  draggedNoteId: number | null;
  isLeftPoolOver: boolean;
  overBoxId: number | null;
  error: string | null;
}

export interface QuotationRow {
  text: string;
  page: string;
}

export interface InsightsState {
  insights: InsightItem[];
  isLoading: boolean;
  isSubmitting: boolean;
  ideaText: string;
  sharpeningIds: Record<number, boolean>;
  errorMessage: string;
}
