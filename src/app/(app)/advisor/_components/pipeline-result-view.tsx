"use client";

import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

import type {
  AuditFindingSeverity,
  AuditReport,
  PipelineResult,
} from "@/features/advisor/pipeline/types";

interface AuditBannerProps {
  audit: AuditReport;
}

const SEVERITY_LABELS: Record<AuditFindingSeverity, string> = {
  CRITICAL: "Kritik",
  WARNING: "Uyarı",
  NOTE: "Not",
};

const SEVERITY_CLASSES: Record<AuditFindingSeverity, string> = {
  CRITICAL: "bg-destructive/10 text-destructive border-destructive/20",
  WARNING:
    "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  NOTE: "bg-muted/40 text-muted-foreground border-border/30",
};

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
  onApprove?: () => void;
}

/**
 * Renders the Heavy Flow pipeline result attached to an advisor message: the
 * Stage 1 audit banner plus, when the Strict Verification Gate halted the run,
 * the critical finding list that must be resolved before processing continues.
 *
 * @param root0 - Component props.
 * @param root0.pipeline - The persisted pipeline result attached to a message.
 * @param root0.onApprove - Optional callback invoked when the user approves continuing despite critical issues.
 * @returns The audit summary markup, or null when no Stage 1 audit is present.
 */
export function PipelineResultView({
  pipeline,
  onApprove,
}: PipelineResultViewProps) {
  const audit = pipeline.audit;
  if (!audit) return null;

  return (
    <div className="space-y-2">
      <AuditBanner audit={audit} />
      {audit.findings.length > 0 && (
        <div
          className={`rounded-md border p-3 text-xs ${
            audit.hasCriticalIssues
              ? "border-destructive/25 bg-destructive/5 text-destructive"
              : "border-border/40 bg-muted/20 text-foreground"
          }`}
        >
          <p className="font-semibold mb-1.5">
            {audit.hasCriticalIssues
              ? "Denetim Durduruldu — Bulgular"
              : "Denetim Bulguları"}
          </p>
          <ul className="space-y-1.5">
            {audit.findings.map((finding, index) => (
              <li key={index} className="flex gap-2">
                <span
                  className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm border ${SEVERITY_CLASSES[finding.severity]}`}
                >
                  {SEVERITY_LABELS[finding.severity]}
                </span>
                <span className="flex-1 min-w-0 break-words whitespace-pre-wrap font-light">
                  {finding.message}
                </span>
              </li>
            ))}
          </ul>
          {audit.hasCriticalIssues && (
            <>
              <p className="mt-2 font-light">
                Devam etmeden önce bu bulguları gidermek için taslağınızı revize
                ederek yeniden gönderebilir veya onay vererek devam
                edebilirsiniz.
              </p>
              {onApprove && (
                <button
                  type="button"
                  onClick={onApprove}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Onay Ver &amp; Devam Et
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
