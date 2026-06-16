"use client";

import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorDisplay } from "@/components/error-display";
import { OriginalityReportView } from "./originality-report-view";
import { useRiskAnalysis } from "../_hooks/use-risk-analysis";

/**
 * Top-level risk-stage container. Delegates all orchestration
 * (initial fetch, 4-stage analysis pipeline, proceed-to-boxes flow) to the
 * {@link useRiskAnalysis} hook and only renders the current state.
 */
export function RiskContainer() {
  const { loading, error, reportData, startAnalysis, handleProceed } =
    useRiskAnalysis();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (reportData) {
    return (
      <div className="max-w-5xl mx-auto">
        <OriginalityReportView reportData={reportData} />
        <div className="flex justify-end mt-8 pb-12">
          <Button onClick={handleProceed} className="btn-academic-hero">
            Analizi Onayla ve Kutulara Geç
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto pt-10">
        <ErrorDisplay error={error} onRetry={() => startAnalysis()} />
      </div>
    );
  }

  // Idle state — waiting for user to start analysis
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center justify-center space-y-6 max-w-lg mx-auto text-center">
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-full">
          <Sparkles className="w-12 h-12 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Özgünlük ve Risk Analizi
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Yapay zeka asistanınız tez matrisinizi inceleyerek Tavily ve YÖKTEZ
            veri tabanlarında paralel tarama yapacak, karşılaştırmalı bir
            özgünlük ve risk raporu hazırlayacak.
          </p>
        </div>
        <Button
          onClick={startAnalysis}
          className="btn-academic-hero w-full sm:w-auto"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Özgünlük ve Risk Analizini Başlat
        </Button>
      </div>
    </main>
  );
}
