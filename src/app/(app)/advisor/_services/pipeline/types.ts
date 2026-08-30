import { z } from "zod";
import type { JsonSchema } from "@/core/services/ai";
import type {
  JuryCritique as CoreJuryCritique,
  OfficeReviewReport as CoreOfficeReviewReport,
  PipelineResultData as CorePipelineResultData,
  PipelineStage as CorePipelineStage,
  AuditFinding as CoreAuditFinding,
  AuditReport as CoreAuditReport,
  PipelineResult as CorePipelineResult,
  JuryCritiqueCategory as CoreJuryCritiqueCategory,
  AuditFindingSeverity as CoreAuditFindingSeverity,
} from "@/core/types/jsonb";

/** Pipeline stage identifiers emitted over the advisor SSE stream (Heavy Flow runs Stage 1 Audit only). */
export type PipelineStage = CorePipelineStage;

/** Severity classification for a single audit finding. */
export type AuditFindingSeverity = CoreAuditFindingSeverity;

/** Zod schema for a single audit finding verifying citation accuracy against RAG context. */
export const auditFindingSchema = z.object({
  message: z.string(),
  severity: z.enum(["CRITICAL", "WARNING", "NOTE"]),
  sourceTitle: z.string().optional(),
  citedPages: z.string().optional(),
});

/** A single audit finding verifying citation accuracy and claim consistency against RAG context. */
export type AuditFinding = CoreAuditFinding;

/** Zod schema for the structured output of the Stage 1 strict audit layer. */
export const auditReportSchema = z.object({
  summary: z.string(),
  findings: z.array(auditFindingSchema),
  hasCriticalIssues: z.boolean(),
});

/** Structured output of the Stage 1 strict audit layer. */
export type AuditReport = CoreAuditReport;

/** JSON schema used for Gemini structured content generation of the Stage 1 audit report. */
export const auditReportJsonSchema: JsonSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Turkish summary of the overall Stage 1 audit verdict.",
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description:
              "Turkish description of the audit finding or confirmation.",
          },
          severity: {
            type: "string",
            enum: ["CRITICAL", "WARNING", "NOTE"],
          },
          sourceTitle: {
            type: "string",
            description: "Related library resource title when applicable.",
          },
          citedPages: {
            type: "string",
            description:
              "The page reference occurrence cited in the draft (e.g. s. 45).",
          },
        },
        required: ["message", "severity"],
        additionalProperties: false,
      },
    },
    hasCriticalIssues: {
      type: "boolean",
      description:
        "True when at least one CRITICAL citation/page inconsistency was found.",
    },
  },
  required: ["summary", "findings", "hasCriticalIssues"],
  additionalProperties: false,
};

/** Persisted pipeline result attached to a chat message (Heavy Flow Stage 1 audit outcome). */
export type PipelineResult = CorePipelineResult;

/** Category of jury critique / Socratic challenge. */
export type JuryCritiqueCategory = CoreJuryCritiqueCategory;

/** A single jury remark / critique identified during the draft audit. */
export type JuryCritique = CoreJuryCritique;

/** Structured output of the Office Review stage (Audit + Diff + Jury Remarks). */
export type OfficeReviewReport = CoreOfficeReviewReport;

/** Pipeline result type for Academic Pipeline / Office Hours stored on chat messages. */
export type PipelineResultData = CorePipelineResultData;
