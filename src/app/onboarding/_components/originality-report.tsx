"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { GapAnalysisSection } from "./gap-analysis";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

interface OriginalityReportProps {
  reportData: {
    risk: string;
    reasoning: string;
    gapAnalysis: string;
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
    <Dialog>
      <DialogTrigger
        className="w-full text-left border border-border/80 hover:border-primary/60 bg-secondary/30 hover:bg-secondary/50 p-4 rounded-lg flex items-center justify-between gap-4 transition-all cursor-pointer relative overflow-hidden group shadow-md"
      >
        {/* Subtle top indicator border */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary/40 group-hover:bg-primary transition-colors" />
        
        <div className="flex items-center space-x-3">
          <div className="bg-primary/10 p-2 rounded-md border border-primary/20">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold tracking-wider text-foreground uppercase font-mono">
              Akademik Özgünlük Değer Raporu (Tezara)
            </h4>
            <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
              Tez fikrinin literatür çakışma ve gap analizi detayları için tıklayın.
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 shrink-0">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${riskColor}`}
          >
            Çakışma Riski: {reportData.risk}
          </span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors animate-in fade-in slide-in-from-right-1 duration-200" />
        </div>
      </DialogTrigger>

      <DialogContent className="max-w-2xl bg-card border border-border p-6 text-foreground shadow-2xl rounded-xl">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <DialogTitle className="text-sm font-bold tracking-wider uppercase font-mono">
                Akademik Özgünlük Raporu
              </DialogTitle>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${riskColor}`}
            >
              Çakışma Riski: {reportData.risk}
            </span>
          </div>
          <DialogDescription className="text-[11px] text-muted-foreground font-sans mt-1">
            Gemini 3.1 Flash Lite ve Tezara veri tabanı entegrasyonu ile üretilen literatür analiz raporudur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Jüri Benzerlik Değerlendirmesi */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono border-b border-border/50 pb-1">
              Jüri Benzerlik Değerlendirmesi (Neden Orijinal?)
            </h4>
            <div className="text-xs text-foreground leading-relaxed font-sans prose prose-invert max-w-none">
              <ReactMarkdown>{reportData.reasoning}</ReactMarkdown>
            </div>
          </div>

          {/* Stratejik Özgün Değer Tavsiyeleri (Gap Analizi) */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono border-b border-border/50 pb-1">
              Stratejik Özgün Değer Tavsiyeleri (Gap Analizi)
            </h4>
            <GapAnalysisSection gapAnalysis={reportData.gapAnalysis} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

