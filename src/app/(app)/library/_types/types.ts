/** Box types matching the thesis matrix boxes in the Fabricca system. */
export type ThesisBoxType =
  | "ALL"
  | "SUBJECT_PROBLEM"
  | "THEORETICAL_FRAMEWORK"
  | "PRIMARY_MATERIAL"
  | "METHODOLOGY";

/** Note types for individual citations and academic notes. */
export type NoteType = "DIRECT_QUOTE" | "PARAPHRASE" | "PERSONAL_NOTE";

/** A single academic resource item stored in the Library. */
export interface LibraryResourceItem {
  id: number;
  boxType: Exclude<ThesisBoxType, "ALL">;
  subBoxId?: number;
  subBoxTitle?: string;
  title: string;
  authors: string[];
  publisher: string;
  publicationYear: number | null;
  doi?: string;
  openalexId?: string;
  isRead: boolean;
  pdfUrl?: string;
  pdfFileName?: string;
  pdfFileSize?: number;
  pdfStatus?: "NOT_UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  createdAt: string;
}

/** A note or page-numbered citation linked to a library resource. */
export interface LibraryResourceNote {
  id: number;
  resourceId: number;
  pageNumber: string;
  noteType: NoteType;
  content: string;
  comment?: string;
  sentToCitationCards: boolean;
  createdAt: string;
}
