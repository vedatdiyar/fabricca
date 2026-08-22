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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ResourceAuditReport } from "../../_lib/types";

interface CritiqueAuditPanelProps {
  auditReport: ResourceAuditReport;
}

/**
 * High-contrast, crystal-clear panel displaying holistic LLM audit evaluation of library notes and critique.
 *
 * @param props - Component props.
 * @param props.auditReport - Structured academic audit results from the LLM.
 * @returns The audit report card markup.
 */
export function CritiqueAuditPanel({ auditReport }: CritiqueAuditPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card className="border border-border bg-card shadow-xs overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h4 className="font-serif text-sm sm:text-base font-semibold tracking-tight text-foreground">
              Akademik Not ve Eser Değerlendirme Raporu
            </h4>
            <Badge
              variant="outline"
              className={
                auditReport.statusBadge === "EXCELLENT"
                  ? "bg-success/10 text-success border-success/30 text-xs font-semibold px-2 py-0.5"
                  : auditReport.statusBadge === "SOLID"
                    ? "bg-primary/10 text-primary border-primary/30 text-xs font-semibold px-2 py-0.5"
                    : "bg-warning/10 text-warning border-warning/30 text-xs font-semibold px-2 py-0.5"
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
          <div className="space-y-3 pt-1 text-xs">
            {/* General Assessment Summary */}
            <div className="p-3.5 bg-background/80 rounded-md border border-border text-foreground font-sans text-xs sm:text-sm leading-relaxed">
              {auditReport.summary}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Strengths */}
              {auditReport.strengths.length > 0 && (
                <div className="rounded-md border border-border bg-background/80 p-3.5 space-y-2 border-l-2 border-l-success">
                  <div className="flex items-center gap-1.5 text-success font-semibold text-xs">
                    <Check className="h-3.5 w-3.5" /> Güçlü Yakalanan Boyutlar
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-foreground text-xs leading-relaxed font-sans">
                    {auditReport.strengths.map((str, i) => (
                      <li key={i}>{str}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Blind spots */}
              {auditReport.blindSpots.length > 0 && (
                <div className="rounded-md border border-border bg-background/80 p-3.5 space-y-2 border-l-2 border-l-warning">
                  <div className="flex items-center gap-1.5 text-warning font-semibold text-xs">
                    <AlertTriangle className="h-3.5 w-3.5" /> Gözden Kaçan / Eksik Noktalar
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-foreground text-xs leading-relaxed font-sans">
                    {auditReport.blindSpots.map((spot, i) => (
                      <li key={i}>{spot}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Commentary risks */}
            {auditReport.commentaryRisks.length > 0 && (
              <div className="rounded-md border border-border bg-background/80 p-3.5 space-y-2 border-l-2 border-l-destructive">
                <div className="flex items-center gap-1.5 text-destructive font-semibold text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" /> Şerh ve Yorum Uyarısı
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-foreground text-xs leading-relaxed font-sans">
                  {auditReport.commentaryRisks.map((risk, i) => (
                    <li key={i}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Thesis Alignment Advice */}
            {auditReport.thesisAlignmentAdvice && (
              <div className="rounded-md border border-border bg-background/80 p-3.5 space-y-2 border-l-2 border-l-primary">
                <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
                  <Lightbulb className="h-3.5 w-3.5" /> Tez Probleminizle Eklemlenme Tavsiyesi
                </div>
                <p className="text-foreground text-xs leading-relaxed font-sans">
                  {auditReport.thesisAlignmentAdvice}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
