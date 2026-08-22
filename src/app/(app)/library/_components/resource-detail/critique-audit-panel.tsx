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
 * Minimalist, refined panel displaying holistic LLM audit evaluation of library notes and critique.
 *
 * @param props - Component props.
 * @param props.auditReport - Structured academic audit results from the LLM.
 * @returns The audit report card markup.
 */
export function CritiqueAuditPanel({ auditReport }: CritiqueAuditPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card className="border border-border bg-background">
      <CardContent className="p-4 space-y-3.5">
        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="font-serif text-base font-medium tracking-tight text-foreground">
              Akademik Değerlendirme Raporu
            </h3>
            <Badge
              variant="outline"
              className={
                auditReport.statusBadge === "EXCELLENT"
                  ? "bg-success/10 text-success border-success/30 text-xs font-semibold px-2 py-0.5 ml-1"
                  : auditReport.statusBadge === "SOLID"
                    ? "bg-primary/10 text-primary border-primary/30 text-xs font-semibold px-2 py-0.5 ml-1"
                    : "bg-warning/10 text-warning border-warning/30 text-xs font-semibold px-2 py-0.5 ml-1"
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
          <div className="space-y-3.5 pt-0.5">
            {/* General Assessment Summary */}
            <p className="font-sans text-xs sm:text-sm text-foreground/90 leading-relaxed">
              {auditReport.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Strengths */}
              {auditReport.strengths.length > 0 && (
                <div className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-success font-semibold text-xs">
                    <Check className="h-3.5 w-3.5" />
                    <span>Güçlü Yakalanan Boyutlar</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-foreground/90 leading-relaxed font-sans">
                    {auditReport.strengths.map((str, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-muted-foreground select-none">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Blind spots */}
              {auditReport.blindSpots.length > 0 && (
                <div className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-warning font-semibold text-xs">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Gözden Kaçan / Eksik Noktalar</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-foreground/90 leading-relaxed font-sans">
                    {auditReport.blindSpots.map((spot, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-muted-foreground select-none">•</span>
                        <span>{spot}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Commentary risks */}
            {auditReport.commentaryRisks.length > 0 && (
              <div className="rounded-md border border-border/40 border-l-2 border-l-warning/70 bg-muted/20 px-3.5 py-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-warning font-semibold text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Şerh ve Yorum Uyarısı</span>
                </div>
                <ul className="space-y-1 text-xs text-foreground/90 leading-relaxed font-sans">
                  {auditReport.commentaryRisks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-muted-foreground select-none">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Thesis Alignment Advice */}
            {auditReport.thesisAlignmentAdvice && (
              <div className="rounded-md border border-border/40 border-l-2 border-l-primary/70 bg-muted/20 px-3.5 py-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span>Tez Probleminizle Eklemlenme Tavsiyesi</span>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed font-sans">
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

