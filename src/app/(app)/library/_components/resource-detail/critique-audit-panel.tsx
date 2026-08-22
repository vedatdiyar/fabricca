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

  return (
    <div className="rounded-md border border-border bg-card/50 p-4 sm:p-5 space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-base sm:text-lg font-medium tracking-tight text-foreground">
            Akademik Değerlendirme Raporu
          </h3>
          <Badge
            variant="outline"
            className={
              auditReport.statusBadge === "EXCELLENT" ||
              auditReport.statusBadge === "SOLID"
                ? "bg-primary/10 text-primary border-primary/20 text-xs font-semibold px-2 py-0.5"
                : "bg-warning/10 text-warning border-warning/20 text-xs font-semibold px-2 py-0.5"
            }
          >
            Skor: {auditReport.overallScore}/100
          </Badge>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Raporu genişlet veya daralt"
        >
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-4 pt-1">
          {/* General Assessment Summary */}
          <p className="font-sans text-xs sm:text-sm text-foreground/90 leading-relaxed">
            {auditReport.summary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Strengths */}
            {auditReport.strengths.length > 0 && (
              <div className="rounded-md border border-primary/20 bg-primary/10 p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Güçlü Yakalanan Boyutlar</span>
                </div>
                <ul className="space-y-1.5 text-xs text-foreground/90 leading-relaxed font-sans">
                  {auditReport.strengths.map((str, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-primary/60 select-none">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Blind spots */}
            {auditReport.blindSpots.length > 0 && (
              <div className="rounded-md border border-warning/20 bg-warning/10 p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-warning font-semibold text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  <span>Gözden Kaçan / Eksik Noktalar</span>
                </div>
                <ul className="space-y-1.5 text-xs text-foreground/90 leading-relaxed font-sans">
                  {auditReport.blindSpots.map((spot, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-warning/60 select-none">•</span>
                      <span>{spot}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Commentary risks */}
          {auditReport.commentaryRisks.length > 0 && (
            <div className="rounded-md border border-warning/20 border-l-2 border-l-warning bg-warning/10 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-warning font-semibold text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <span>Şerh ve Yorum Uyarısı</span>
              </div>
              <ul className="space-y-1 text-xs text-foreground/90 leading-relaxed font-sans">
                {auditReport.commentaryRisks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-warning/60 select-none">•</span>
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
                <Lightbulb className="h-3.5 w-3.5 text-primary" />
                <span>Tez Probleminizle Eklemlenme Tavsiyesi</span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed font-sans">
                {auditReport.thesisAlignmentAdvice}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
