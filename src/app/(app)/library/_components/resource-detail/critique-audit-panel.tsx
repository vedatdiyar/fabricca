"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ResourceAuditReport } from "../../_lib/types";

interface CritiqueAuditPanelProps {
  auditReport: ResourceAuditReport;
}

/**
 * Minimalist, refined panel displaying holistic LLM audit evaluation of library notes and critique.
 *
 * @param props - Component props.
 * @param props.auditReport - Structured academic audit results from the LLM.
 * @returns The audit report card markup.
 */
export function CritiqueAuditPanel({ auditReport }: CritiqueAuditPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  const strengths = auditReport.strengths ?? [];
  const blindSpots = auditReport.blindSpots ?? [];
  const commentaryRisks = auditReport.commentaryRisks ?? [];

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-4 shadow-xs">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
            Akademik Değerlendirme Raporu
          </h3>
          <Badge
            variant="outline"
            className={
              auditReport.statusBadge === "EXCELLENT" ||
              auditReport.statusBadge === "SOLID"
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-warning/10 text-warning border-warning/20"
            }
          >
            Skor: {auditReport.overallScore}/100
          </Badge>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
          aria-label="Raporu genişlet veya daralt"
        >
          {isOpen ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-4 pt-1">
          {/* General Assessment Summary */}
          <p className="font-sans text-sm text-foreground leading-relaxed">
            {auditReport.summary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Strengths */}
            {strengths.length > 0 && (
              <div className="rounded-md border border-primary/20 bg-primary/10 p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
                  <Check className="size-3.5 text-primary" />
                  <span>Güçlü Yakalanan Boyutlar</span>
                </div>
                <ul className="space-y-1.5 text-xs text-foreground leading-relaxed font-sans">
                  {strengths.map((str, i) => (
                    <li
                      key={`strength-${i}-${str.slice(0, 32)}`}
                      className="flex items-start gap-1.5"
                    >
                      <span className="text-primary select-none">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Blind spots */}
            {blindSpots.length > 0 && (
              <div className="rounded-md border border-warning/20 bg-warning/10 p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-warning font-semibold text-xs">
                  <AlertTriangle className="size-3.5 text-warning" />
                  <span>Gözden Kaçan / Eksik Noktalar</span>
                </div>
                <ul className="space-y-1.5 text-xs text-foreground leading-relaxed font-sans">
                  {blindSpots.map((spot, i) => (
                    <li
                      key={`spot-${i}-${spot.slice(0, 32)}`}
                      className="flex items-start gap-1.5"
                    >
                      <span className="text-warning select-none">•</span>
                      <span>{spot}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Commentary risks */}
          {commentaryRisks.length > 0 && (
            <div className="rounded-md border border-warning/20 border-l-2 border-l-warning bg-warning/10 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-warning font-semibold text-xs">
                <AlertTriangle className="size-3.5 text-warning" />
                <span>Şerh ve Yorum Uyarısı</span>
              </div>
              <ul className="space-y-1 text-xs text-foreground leading-relaxed font-sans">
                {commentaryRisks.map((risk, i) => (
                  <li
                    key={`risk-${i}-${risk.slice(0, 32)}`}
                    className="flex items-start gap-1.5"
                  >
                    <span className="text-warning select-none">•</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Thesis Alignment Advice */}
          {auditReport.thesisAlignmentAdvice && (
            <div className="rounded-md border border-primary/20 border-l-2 border-l-primary bg-primary/10 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
                <Lightbulb className="size-3.5 text-primary" />
                <span>Tez Probleminizle Eklemlenme Tavsiyesi</span>
              </div>
              <p className="text-xs text-foreground leading-relaxed font-sans">
                {auditReport.thesisAlignmentAdvice}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
