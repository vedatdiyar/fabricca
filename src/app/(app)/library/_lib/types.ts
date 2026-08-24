import type { ThesisBoxType as BaseThesisBoxType } from "@/lib/box-constants";

/** Box types matching the thesis matrix boxes in the Fabricca system. */
export type ThesisBoxType = BaseThesisBoxType | "ALL";

/** Note types for individual citations and academic notes. */
export type NoteType = "DIRECT_QUOTE" | "PARAPHRASE" | "PERSONAL_NOTE";

/** Verification status for note grounding and page check. */
export type NoteVerificationStatus =
  "UNVERIFIED" | "PENDING" | "VERIFIED" | "WARNING";

/** Issue item detected during single note verification. */
export interface NoteVerificationIssue {
  type:
    | "PAGE_MISMATCH"
    | "VERBATIM_DIFF"
    | "INTERPRETATION_CONFLICT"
    | "NOTE_TYPE_MISMATCH"
    | "FORMAT_WARNING";
  severity: "LOW" | "MEDIUM" | "HIGH";
  title: string;
  description: string;
  suggestedFix?: string;
  suggestedPage?: string;
}

/** Detailed verification result stored per note. */
export interface NoteVerificationData {
  status: "VERIFIED" | "WARNING";
  confidence: number;
  detectedPage?: string;
  summary: string;
  issues: NoteVerificationIssue[];
  academicAdvice?: string;
  verifiedAt: string;
}

/** Holistic audit report generated for a resource's notes and critique. */
export interface ResourceAuditReport {
  overallScore: number;
  statusBadge: "EXCELLENT" | "SOLID" | "NEEDS_ATTENTION";
  summary: string;
  strengths: string[];
  blindSpots: string[];
  commentaryRisks: string[];
  thesisAlignmentAdvice: string;
  evaluatedAt: string;
}

/** A single academic resource item stored in the Library. */
export interface LibraryResourceItem {
  id: number;
  boxType: Exclude<ThesisBoxType, "ALL">;
  subBoxId?: number;
  subBoxTitle?: string;
  title: string;
  authors: string[];
  containerTitle?: string;
  documentType?: string;
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

/** A single outline section item for chapter selection in library. */
export interface LibraryOutlineItem {
  id: number;
  parentId: number | null;
  title: string;
  description: string | null;
  sortOrder: number;
  academicField?: string | null;
}

/** A note or page-numbered citation linked to a library resource. */
export interface LibraryResourceNote {
  id: number;
  resourceId: number;
  pageNumber: string;
  noteType: NoteType;
  content: string;
  comment?: string;
  outlineIds?: number[];
  sentToCitationCards: boolean;
  verificationStatus: NoteVerificationStatus;
  verificationData?: NoteVerificationData;
  createdAt: string;
}

/** The 1:1 article analysis (Eser Analizi) stored per library source. */
export interface LibraryResourceCritique {
  resourceId: number;
  researchQuestion?: string;
  theoreticalFramework?: string;
  methodology?: string;
  mainArgument?: string;
  literatureGap?: string;
  aiEvaluation?: ResourceAuditReport;
  evaluatedAt?: string;
  updatedAt?: string;
}
