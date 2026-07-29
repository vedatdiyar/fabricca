/**
 * Box types matching the thesis matrix boxes in Fabricca system.
 */
export type ThesisBoxType =
  | "ALL"
  | "SUBJECT_PROBLEM"
  | "THEORETICAL_FRAMEWORK"
  | "PRIMARY_MATERIAL"
  | "METHODOLOGY";

/**
 * Note types for individual citations and academic notes.
 */
export type NoteType = "DIRECT_QUOTE" | "PARAPHRASE" | "PERSONAL_NOTE";

/**
 * Represents a single academic resource item stored in the Library.
 */
export interface LibraryResourceItem {
  /** Unique ID of the resource */
  id: number;
  /** Linked thesis box type */
  boxType: Exclude<ThesisBoxType, "ALL">;
  /** Title of the paper, book, or thesis */
  title: string;
  /** Array of author names */
  authors: string[];
  /** Publisher, journal, or venue name */
  publisher: string;
  /** Year of publication */
  publicationYear: number;
  /** Digital Object Identifier (DOI) if available */
  doi?: string;
  /** Direct URL link to the resource or PDF */
  url?: string;
  /** Whether the user has marked this resource as read */
  isRead: boolean;
  /** PDF storage URL if uploaded */
  pdfUrl?: string;
  /** Original PDF file name */
  pdfFileName?: string;
  /** PDF file size in bytes */
  pdfFileSize?: number;
  /** PDF processing & vectorization status */
  pdfStatus?: "NOT_UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  /** Total page count of PDF */
  pageCount?: number;
  /** Source origin tag (e.g., Onboarding, OpenAlex, Crossref) */
  sourceOrigin: "ONBOARDING" | "LITERATURE_EXPANSION";
  /** Creation timestamp formatted ISO string */
  createdAt: string;
}

/**
 * Represents an individual note or page-numbered citation linked to a library resource.
 */
export interface LibraryResourceNote {
  /** Unique ID of the note */
  id: number;
  /** ID of the parent library resource */
  resourceId: number;
  /** Page number or page range reference (e.g. "s. 45", "45-48") */
  pageNumber: string;
  /** Classification of the note */
  noteType: NoteType;
  /** Content of the note or direct quote */
  content: string;
  /** Whether this note has been exported to the Card Index (Kartoteks) */
  sentToCardIndex: boolean;
  /** Timestamp when the note was recorded */
  createdAt: string;
}
