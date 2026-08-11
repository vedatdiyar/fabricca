/** Pipeline stage identifiers emitted over the advisor SSE stream. */
export type PipelineStage = "audit" | "socratic" | "redaction";

/** Severity classification for a single audit finding. */
export type AuditFindingSeverity = "CRITICAL" | "WARNING" | "NOTE";

/** A single audit finding verifying citation accuracy and claim consistency against RAG context. */
export interface AuditFinding {
  /** Human-readable Turkish description of the issue or confirmation. */
  message: string;
  severity: AuditFindingSeverity;
  /** The resource title this finding is related to, when applicable. */
  sourceTitle?: string;
  /** The page reference occurrence cited in the draft, e.g. "s. 45". */
  citedPages?: string;
}

/** Structured output of the Stage 1 strict audit layer. */
export interface AuditReport {
  /** Turkish summary of the overall audit verdict. */
  summary: string;
  findings: AuditFinding[];
  /** True when at least one CRITICAL citation/page discrepancy was found. */
  hasCriticalIssues: boolean;
}

/** Internal evaluation state reached at the end of a Socratic discussion cycle. */
export type SocraticState = "REQUIRES_ANSWER" | "COMPLETE";

/** Structured Socratic evaluation output that prevents infinite looping or immediate concession. */
export interface SocraticVerdict {
  state: SocraticState;
  /** Turkish summary of the internal evaluation across logic, thesis consistency and counter-arguments. */
  summary: string;
  /** Internal readiness score (0-100) indicating how close the draft is to being convincingly defended. */
  readinessScore: number;
}

/** Side-by-side diff visualisation payload shipped to the client. */
export interface PipelineDiff {
  original: string;
  polished: string;
}

/** Persisted pipeline state attached to a chat message. */
export interface PipelineResult {
  stage: PipelineStage;
  /** Total discussion cycles elapsed (drives the anti-infinite-loop cap). */
  cycle: number;
  /** The original draft paragraph that initiated the pipeline, retained for continuation turns. */
  originalDraft?: string;
  audit?: AuditReport;
  verdict?: SocraticVerdict;
  diff?: PipelineDiff;
}

/** In-memory streaming state for a running pipeline turn. */
export interface PipelineTurnState {
  pipeline: PipelineResult;
  pendingToolCalls: unknown[];
  fullText: string;
}
