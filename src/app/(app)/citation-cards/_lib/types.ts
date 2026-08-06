import type { ThesisBoxType } from "@/lib/box-constants";

/** Academic note type enum values matching notes.noteTypeEnum in schema.ts. */
export type CitationNoteType = "DIRECT_QUOTE" | "PARAPHRASE" | "PERSONAL_NOTE";

/**
 * Card item representing an academic citation card (Alıntı Fişi),
 * matching DB schema tables `notes`, `sources`, and `boxes`.
 */
export interface CitationCardItem {
  id: number;
  sourceId: number;
  sourceTitle: string;
  sourceAuthors: string[];
  sourceYear: number;
  boxId: number;
  boxType: ThesisBoxType;
  boxTitle: string;
  pageNumber: string;
  noteType: CitationNoteType;
  content: string;
  comment?: string;
  sentToCitationCards: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Topic box item matching DB `boxes` table. */
export interface BoxItem {
  id: number;
  boxType: ThesisBoxType;
  title: string;
  description: string;
  cardCount: number;
}

/** Source item matching DB `sources` table. */
export interface SourceItem {
  id: number;
  boxId: number;
  title: string;
  authors: string[];
  publisher: string;
  publicationYear: number;
}
