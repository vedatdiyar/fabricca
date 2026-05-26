"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, BookOpen } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { ThesisRow } from "./thesis-row";
import { GapAnalysisSection } from "./gap-analysis";

interface OriginalityReportProps {
  reportData: {
    risk: string;
    reasoning: string;
    gapAnalysis: string;
    theses?: any[];
  };
}

export function OriginalityReport({ reportData }: OriginalityReportProps) {
  let riskColor = "text-chart-5 border-chart-5 bg-chart-5/10";
  if (reportData.risk === "Orta") {
    riskColor = "text-chart-2 border-chart-2 bg-chart-2/10";
  } else if (reportData.risk === "Yüksek") {
    riskColor = "text-chart-4 border-chart-4 bg-chart-4/10";
  }

  return (
    <div className="w-full border border-primary/40 bg-card rounded-lg p-5 space-y-4 my-4 relative overflow-hidden shadow-xl">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <h3 className="text-xs font-bold tracking-wider text-foreground uppercase font-mono">
            Akademik Özgünlük Değer Raporu (Tezara)
          </h3>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${riskColor}`}
        >
          Çakışma Riski: {reportData.risk}
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono">
          Jüri Benzerlik Değerlendirmesi
        </h4>
        <div className="text-xs text-foreground leading-relaxed font-sans prose prose-invert max-w-none">
          <ReactMarkdown>{reportData.reasoning}</ReactMarkdown>
        </div>
      </div>

      {reportData.theses && reportData.theses.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            İlişkili Türkiye Menşeili Tez Eşleşmeleri (
            {reportData.theses.length})
          </h4>
          <Accordion className="w-full space-y-2">
            {reportData.theses.map((thesis) => (
              <ThesisRow key={thesis.id} thesis={thesis} />
            ))}
          </Accordion>
        </div>
      )}

      <div className="space-y-1 pt-2 border-t border-border">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono">
          Stratejik Özgün Değer Tavsiyeleri (Gap Analizi)
        </h4>
        <GapAnalysisSection gapAnalysis={reportData.gapAnalysis} />
      </div>
    </div>
  );
}
