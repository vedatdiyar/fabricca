import { z } from "zod";
import type { JsonSchema } from "@/services/ai";

/** Pipeline stage identifiers emitted over the advisor SSE stream (Heavy Flow runs Stage 1 Audit only). */
export type PipelineStage = "audit";

/** Severity classification for a single audit finding. */
export type AuditFindingSeverity = "CRITICAL" | "WARNING" | "NOTE";

/** Zod schema for a single audit finding verifying citation accuracy against RAG context. */
export const auditFindingSchema = z.object({
  message: z.string(),
  severity: z.enum(["CRITICAL", "WARNING", "NOTE"]),
  sourceTitle: z.string().optional(),
  citedPages: z.string().optional(),
});

/** A single audit finding verifying citation accuracy and claim consistency against RAG context. */
export type AuditFinding = z.infer<typeof auditFindingSchema>;

/** Zod schema for the structured output of the Stage 1 strict audit layer. */
export const auditReportSchema = z.object({
  summary: z.string(),
  findings: z.array(auditFindingSchema),
  hasCriticalIssues: z.boolean(),
});

/** Structured output of the Stage 1 strict audit layer. */
export type AuditReport = z.infer<typeof auditReportSchema>;

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
export interface PipelineResult {
  stage: PipelineStage;
  audit?: AuditReport;
}

/** Pipeline result type for the three-stage Academic Pipeline stored on chat messages. */
export interface PipelineResultData {
  stage: "audit" | "socratic" | "redaction";
  cycle: number;
  originalDraft?: string;
  audit?: {
    summary: string;
    findings: Array<{
      message: string;
      severity: "CRITICAL" | "WARNING" | "NOTE";
      sourceTitle?: string;
      citedPages?: string;
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
  };
}
