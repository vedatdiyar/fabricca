"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorDisplay } from "@/components/error-display";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { LoadingStep } from "@/lib/store/onboarding-store";
import { searchAndSiftThesesAction, runJuryAnalysisAction, completeRiskStageAction } from "../actions";
import { generateBoxesAction } from "../../boxes/actions";
import { fetchThesisMatrix, fetchOriginalityReport } from "../../lib/fetch-actions";
import { OriginalityReportView } from "./originality-report-view";
import type { OriginalityReportData } from "@/lib/types";

const ANALYSIS_STEPS: LoadingStep[] = [
  { text: "Sorgu ve doğrulama parametreleri üretiliyor...", status: "idle" },
  { text: "Tavily ve Tezara paralel motorları koşturuluyor...", status: "idle" },
  { text: "Karşılaştırmalı literatür matrisi yapılandırılıyor...", status: "idle" },
  { text: "Nihai risk seviyesi ve tavsiyeler hazırlanıyor...", status: "idle" },
];

export function RiskContainer() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<OriginalityReportData | null>(null);
  const [matrixData, setMatrixData] = useState<any>(null);
  const showLoading = useOnboardingStore((s) => s.showLoading);
  const hideLoading = useOnboardingStore((s) => s.hideLoading);
  const updateLoadingStep = useOnboardingStore((s) => s.updateLoadingStep);

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

    const steps = ANALYSIS_STEPS.map((s) => ({ ...s }));
    steps[0].status = "active";
    showLoading(
      "Risk Analiz Motorları Çalışıyor",
      "Yapay zeka asistanınız tez matrisinizi inceliyor, veri tabanlarını tarıyor ve risk raporunu hazırlıyor.",
      steps,
    );

    try {
      let matrix = matrixData;
      if (!matrix) {
        matrix = await fetchThesisMatrix();
        if (!matrix) {
          setError("Tez matrisi bulunamadı.");
          setAnalysing(false);
          hideLoading();
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

      // Step 1 done → Step 2 active
      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");

      const searchResult = await searchAndSiftThesesAction(matrixInput);
      if ("error" in searchResult) {
        setError(searchResult.error);
        setAnalysing(false);
        hideLoading();
        return;
      }

      // Step 2 done → Step 3 active
      updateLoadingStep(1, "completed");
      updateLoadingStep(2, "active");

      const juryResult = await runJuryAnalysisAction(
        searchResult.scrapedTheses,
        searchResult.tavilyResults,
        matrixInput,
      );

      if ("error" in juryResult) {
        setError(juryResult.error);
        hideLoading();
      } else {
        // Step 3 done → Step 4 active → complete
        updateLoadingStep(2, "completed");
        updateLoadingStep(3, "active");
        // Brief pause so user sees final step
        await new Promise((r) => setTimeout(r, 600));
        updateLoadingStep(3, "completed");
        await new Promise((r) => setTimeout(r, 400));
        setReportData(juryResult.data);
        hideLoading();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analiz sırasında bir hata oluştu.");
      hideLoading();
    } finally {
      setAnalysing(false);
    }
  }, [matrixData, showLoading, hideLoading, updateLoadingStep]);

  const handleProceed = async () => {
    const proceedSteps: LoadingStep[] = [
      { text: "Risk raporu veri tabanına kaydediliyor...", status: "active" },
      { text: "Konu kutuları oluşturuluyor...", status: "idle" },
      { text: "Kutular sayfasına yönlendiriliyor...", status: "idle" },
    ];

    showLoading(
      "İşlem Tamamlanıyor",
      "Risk analizi sonuçları kaydediliyor ve konu kutuları yapılandırılıyor.",
      proceedSteps,
    );

    const result = await completeRiskStageAction();
    if (result.error) {
      hideLoading();
      toast.error(result.error);
      return;
    }

    updateLoadingStep(0, "completed");
    updateLoadingStep(1, "active");

    const boxesResult = await generateBoxesAction();
    if ("error" in boxesResult) {
      hideLoading();
      toast.error(boxesResult.error);
      router.push("/onboarding/boxes");
      return;
    }

    updateLoadingStep(1, "completed");
    updateLoadingStep(2, "active");

    useOnboardingStore.getState().setBoxes(boxesResult.boxes);
    await new Promise((r) => setTimeout(r, 300));
    hideLoading();
    router.push("/onboarding/boxes");
  };

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
          <h2 className="text-xl font-semibold text-foreground">Özgünlük ve Risk Analizi</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Yapay zeka asistanınız tez matrisinizi inceleyerek Tavily ve
            YÖKTEZ veri tabanlarında paralel tarama yapacak, karşılaştırmalı
            bir özgünlük ve risk raporu hazırlayacak.
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
