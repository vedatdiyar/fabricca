"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorDisplay } from "@/components/error-display";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { searchAndSiftThesesAction, runJuryAnalysisAction, completeRiskStageAction } from "../actions";
import { fetchThesisMatrix, fetchOriginalityReport } from "../../lib/fetch-actions";
import { OriginalityReportView } from "./originality-report-view";
import type { ScrapedTheses, TavilyEvaluationResponse, OriginalityReportData } from "@/lib/types";

const STEPS = [
  "Sorgu ve doğrulama parametreleri üretiliyor...",
  "Tavily ve Tezara paralel motorları koşturuluyor...",
  "Karşılaştırmalı literatür matrisi yapılandırılıyor...",
  "Nihai risk seviyesi ve tavsiyeler hazırlanıyor...",
];

export function RiskContainer() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<OriginalityReportData | null>(null);
  const [secondsPassed, setSecondsPassed] = useState(0);
  const [matrixData, setMatrixData] = useState<any>(null);
  const hasAutoStarted = useRef(false);

  // Load existing report on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const matrix = await fetchThesisMatrix();
      if (!matrix) {
        toast.error("Tez matrisi bulunamadı.");
        router.push("/onboarding/matrix");
        return;
      }
      setMatrixData(matrix);

      const report = await fetchOriginalityReport();
      if (report && !cancelled) {
        setReportData({
          tavilyResults: report.tavilyResults as OriginalityReportData["tavilyResults"],
          tezaraResults: report.tezaraResults as OriginalityReportData["tezaraResults"],
        });
      }
      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startAnalysis = useCallback(async () => {
    setAnalysing(true);
    setError(null);

    try {
      let matrix = matrixData;
      if (!matrix) {
        matrix = await fetchThesisMatrix();
        if (!matrix) {
          setError("Tez matrisi bulunamadı.");
          setAnalysing(false);
          return;
        }
      }

      const matrixInput = {
        studyTitle: matrix.studyTitle,
        researchQuestion: matrix.researchQuestion,
        mainClaim: matrix.mainClaim,
        methodology: matrix.methodology,
        theoreticalFramework: matrix.theoreticalFramework,
        historicalSpatialLimits: matrix.historicalSpatialLimits,
      };

      const searchResult = await searchAndSiftThesesAction(matrixInput);
      if ("error" in searchResult) {
        setError(searchResult.error);
        setAnalysing(false);
        return;
      }

      const juryResult = await runJuryAnalysisAction(
        searchResult.scrapedTheses,
        searchResult.tavilyResults,
        matrixInput,
      );

      if ("error" in juryResult) {
        setError(juryResult.error);
      } else {
        setReportData(juryResult.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analiz sırasında bir hata oluştu.");
    } finally {
      setAnalysing(false);
    }
  }, [matrixData]);

  const handleProceed = async () => {
    const result = await completeRiskStageAction();
    if (result.error) {
      toast.error(result.error);
      return;
    }
    // Clear stale Zustand boxes so the next visit re-generates from scratch
    useOnboardingStore.getState().setBoxes(null);
    router.push("/onboarding/boxes");
  };

  // Auto-start analysis when loading completes and no report exists
  useEffect(() => {
    if (!loading && !reportData && !analysing && !error && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      startAnalysis();
    }
  }, [loading, reportData, analysing, error, startAnalysis]);

  useEffect(() => {
    if (!analysing) {
      setSecondsPassed(0);
      return;
    }
    const interval = setInterval(() => setSecondsPassed((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, [analysing]);

  const activeStep =
    secondsPassed <= 3 ? 0 : secondsPassed <= 24 ? 1 : secondsPassed <= 29 ? 2 : 3;

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

  if (analysing) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center justify-center space-y-8 max-w-md mx-auto text-center">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <Sparkles className="w-6 h-6 text-primary absolute animate-pulse" />
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Risk Analiz Motorları Çalışıyor</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Yapay zeka asistanınız tez matrisinizi inceliyor, veri tabanlarını tarıyor ve risk raporunu hazırlıyor.
            </p>
          </div>
          <div className="w-full bg-muted border border-border rounded-lg p-5 text-left space-y-4">
            {STEPS.map((label, index) => {
              const isActive = activeStep === index;
              const isCompleted = activeStep > index;
              return (
                <div key={index} className={`flex items-center gap-3 text-sm ${isActive || isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-primary animate-ping" : isCompleted ? "bg-primary" : "bg-border"}`} />
                  <span className={isActive ? "font-medium" : ""}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto pt-10">
        <ErrorDisplay error={error} onRetry={() => startAnalysis()} />
      </div>
    );
  }

  // Auto-starting — show analysing view
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center justify-center space-y-8 max-w-md mx-auto text-center">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <Sparkles className="w-6 h-6 text-primary absolute animate-pulse" />
        </div>
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Risk Analiz Motorları Çalışıyor</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Yapay zeka asistanınız tez matrisinizi inceliyor, veri tabanlarını tarıyor ve risk raporunu hazırlıyor.
          </p>
        </div>
      </div>
    </main>
  );
}
