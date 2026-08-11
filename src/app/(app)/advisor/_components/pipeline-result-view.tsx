"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { SideBySideDiff } from "./side-by-side-diff";
import type {
  AuditReport,
  PipelineResult,
} from "@/lib/services/advisor-pipeline/types";

interface AuditBannerProps {
  audit: AuditReport;
}

/**
 * Renders the compact one-line audit summary banner shown above an advisor bubble.
 *
 * @param root0 - Component props.
 * @param root0.audit - The Stage 1 audit report to summarise.
 * @returns The audit banner markup.
 */
export function AuditBanner({ audit }: AuditBannerProps) {
  return (
    <div
      className={`flex items-start gap-2 max-w-full px-3 py-1.5 rounded-md text-xs border ${
        audit.hasCriticalIssues
          ? "bg-destructive/5 border-destructive/25 text-destructive"
          : "bg-muted/30 border-border/40 text-muted-foreground"
      }`}
    >
      {audit.hasCriticalIssues ? (
        <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
      )}
      <span className="flex-1 min-w-0 break-words whitespace-pre-wrap font-light">
        {audit.summary}
      </span>
      {audit.findings.length > 0 && (
        <span className="shrink-0 mt-0.5 font-semibold tabular-nums px-1.5 py-0.5 rounded-sm text-[10px] bg-primary/10 text-primary">
          {audit.findings.length} bulgu
        </span>
      )}
    </div>
  );
}

interface PipelineResultViewProps {
  pipeline: PipelineResult;
}

/**
 * Renders the structured redaction diff when the final pipeline stage has been
 * reached. Pipeline progress and Socratic verdict blocks are intentionally
 * omitted from the chat UI so bubbles stay clean and conversational.
 *
 * @param root0 - Component props.
 * @param root0.pipeline - The persisted pipeline result attached to a message.
 * @returns The redaction diff markup, or null for non-redaction stages.
 */
export function PipelineResultView({ pipeline }: PipelineResultViewProps) {
  if (pipeline.stage !== "redaction" || !pipeline.diff) return null;
  return (
    <SideBySideDiff
      original={pipeline.diff.original}
      polished={pipeline.diff.polished}
    />
  );
}
