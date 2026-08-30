/**
 * Canonical JSONB domain contracts for Drizzle schema columns.
 * This is the SINGLE source of truth for types persisted as jsonb in the DB.
 * Route-level modules (advisor, library, positioning) MUST import from here,
 * never the reverse. This guarantees src/core never imports from src/app.
 */

// ── Positioning (was src/app/(onboarding)/onboarding/positioning/_services/validation.ts) ──
export type StrategicRole =
  | "SPECIFIC_FOCUS"
  | "FOUNDATIONAL_WORK"
  | "METHODOLOGICAL_BENCHMARK"
  | "ALTERNATIVE_PERSPECTIVE";

export type PositioningGlobalStatus =
  | "DIRECT_OVERLAP"
  | "NOVEL_GAP_IDENTIFIED"
  | "NO_RELATED_LITERATURE";

export interface RecommendedThesisItem {
  id?: string;
  externalThesisId?: string;
  title: string;
  author: string;
  year: number;
  university: string;
  publicationType?: "Tez" | "Makale" | "Kitap" | "Kitap Bölümü" | "Rapor";
  sourceChannel?: "yok" | "openalex" | "semantic_scholar" | "exa";
  strategicRole?: StrategicRole;
  literaturePosition?: string;
  contributionArea: string;
  relevanceReason: string;
  doi?: string;
  thesisType?: string;
  abstract?: string;
  url?: string;
  yokUrl?: string;
}

export interface PivotOption {
  id: "field_pivot" | "theory_pivot" | "method_pivot";
  dimension: "SAHA_ORNEKLEM" | "KURAMSAL_CERCEVE" | "YONTEMSEL_DESEN";
  title: string;
  description: string;
  suggestedFocus: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  category: "scope" | "focus" | "methodology" | "theoretical";
  contextNote: string;
}

export interface OverlappingWork {
  title: string;
  author?: string;
  year?: number;
  sourceType: string;
  reason: string;
  problemOverlap?: string;
  theoryOverlap?: string;
  methodologyOverlap?: string;
}

export interface GapAnalysisStructured {
  literatureMapping: string;
  academicGap: string;
  originalContribution: string;
  overlappingWorks?: OverlappingWork[];
  pivotOptions?: PivotOption[];
  clarificationQuestions?: ClarificationQuestion[];
}

// ── Advisor tool calls (was src/app/(app)/advisor/_lib/types.ts) ──
export interface PendingToolCall {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  explanation: string;
  status: "pending" | "approved" | "rejected" | "undone";
  executionResult?: unknown;
  previousState?: Record<string, unknown>;
}

export type ChatToolCall = PendingToolCall;

// ── Advisor pipeline (was src/app/(app)/advisor/_services/pipeline/types.ts) ──
export type PipelineStage = "audit";

export type AuditFindingSeverity = "CRITICAL" | "WARNING" | "NOTE";

export interface AuditFinding {
  message: string;
  severity: AuditFindingSeverity;
  sourceTitle?: string;
  citedPages?: string;
}

export interface AuditReport {
  summary: string;
  findings: AuditFinding[];
  hasCriticalIssues: boolean;
}

export interface PipelineResult {
  stage: PipelineStage;
  audit?: AuditReport;
}

export type JuryCritiqueCategory =
  | "LOGIC_LEAP"
  | "UNBACKED_CLAIM"
  | "METHODOLOGICAL_GAP";

export interface JuryCritique {
  id: string;
  title: string;
  critique: string;
  category: JuryCritiqueCategory;
  suggestedDefensePoint: string;
}

export interface OfficeReviewReport {
  outlineId?: number;
  draftText?: string;
  studentNote?: string;
  audit: {
    summary: string;
    findings: Array<{
      message: string;
      severity: "CRITICAL" | "WARNING" | "NOTE";
      sourceTitle?: string;
      citedPages?: string;
      status?: "VERIFIED" | "MISMATCH" | "UNVERIFIED";
    }>;
    hasCriticalIssues: boolean;
  };
  diff: {
    original: string;
    polished: string;
    changes: string[];
  };
  juryCritiques: JuryCritique[];
}

export interface PipelineResultData {
  stage:
    | "audit"
    | "socratic"
    | "redaction"
    | "office_review"
    | "office_defense";
  cycle?: number;
  originalDraft?: string;
  outlineId?: number;
  draftText?: string;
  studentNote?: string;
  audit?: {
    summary: string;
    findings: Array<{
      message: string;
      severity: "CRITICAL" | "WARNING" | "NOTE";
      sourceTitle?: string;
      citedPages?: string;
      status?: "VERIFIED" | "MISMATCH" | "UNVERIFIED";
    }>;
    hasCriticalIssues: boolean;
  };
  verdict?: {
    state: "REQUIRES_ANSWER" | "COMPLETE";
    summary: string;
    readinessScore: number;
  };
  diff?: {
    original: string;
    polished: string;
    changes?: string[];
  };
  juryCritiques?: JuryCritique[];
}

// ── Library verification (was src/app/(app)/library/_lib/types.ts) ──
export type NoteVerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "WARNING";

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

export interface NoteVerificationData {
  status: "VERIFIED" | "WARNING";
  confidence: number;
  detectedPage?: string;
  summary: string;
  issues: NoteVerificationIssue[];
  academicAdvice?: string;
  verifiedAt: string;
}

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
