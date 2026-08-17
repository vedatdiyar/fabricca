import { runStage1Audit } from "./stage1-audit";
import type { PipelineResult } from "./types";
import type { RagSearchResultItem } from "@/services/search/rag-search";
import {
  formatAuditFindings,
  buildAuditHaltText,
  FALLBACK_SOCRATIC_TEXT,
} from "./audit-formatter";
import { streamSocraticAdvisorResponse } from "./socratic-stream";

export { formatAuditFindings };

/** SSE event emission and text streaming interface used by the pipeline orchestrator. */
export interface PipelineSseWriter {
  send(type: string, payload: Record<string, unknown>): void;
  delta(text: string): void;
}

/** Inputs driving a single Heavy Flow pipeline turn. */
export interface PipelineTurnInput {
  userId: number;
  originalDraft: string;
}

/** Output produced by a full pipeline turn. */
export interface PipelineTurnOutput {
  text: string;
  sources: RagSearchResultItem[];
  pipeline: PipelineResult;
}

/**
 * Runs the Heavy Flow for a single chat turn: executes the Stage 1 strict audit
 * and applies the Strict Verification Gate. When critical issues are detected
 * the process halts immediately so the user can revise the draft, instead of
 * proceeding to any subsequent processing step.
 *
 * @param writer - The SSE writer.
 * @param input - The pipeline turn input containing the draft paragraph to audit.
 * @returns The turn output including the audit verdict text, grounded sources and pipeline result.
 */
export async function runPipelineTurn(
  writer: PipelineSseWriter,
  input: PipelineTurnInput,
): Promise<PipelineTurnOutput> {
  writer.send("stage_start", { stage: "audit" });
  const { audit, sources, sourceContext } = await runStage1Audit(
    input.userId,
    input.originalDraft,
  );
  writer.send("stage_done", { stage: "audit", payload: audit });

  const findingsText = formatAuditFindings(audit);
  const pipeline: PipelineResult = audit.hasCriticalIssues
    ? { stage: "audit", audit }
    : { stage: "audit" };

  if (audit.hasCriticalIssues) {
    // Strict Verification Gate: halt immediately, no subsequent steps.
    const text = buildAuditHaltText(findingsText);
    writer.delta(text);
    return { text, sources, pipeline };
  }

  // Audit passed — stream Socratic Advisor response
  try {
    const fullText = await streamSocraticAdvisorResponse({
      sourceContext,
      originalDraft: input.originalDraft,
      writer,
    });

    return { text: fullText, sources, pipeline };
  } catch {
    // Fallback: brief acknowledgment if Socratic generation fails
    writer.delta(FALLBACK_SOCRATIC_TEXT);
    return { text: FALLBACK_SOCRATIC_TEXT, sources, pipeline };
  }
}
