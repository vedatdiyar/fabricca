"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { LoadingStep } from "@/lib/store/onboarding-store";
import type { OriginalityReportData } from "@/lib/types";
import type { ThesisMatrix } from "@/db/schema";
import {
  extractQueriesAction,
  executeSearchAction,
  siftThesesAction,
  finalizeJuryAnalysisAction,
  completeRiskStageAction,
} from "../actions";
import { generateBoxesAction } from "../../boxes/actions";
import {
  fetchThesisMatrix,
  fetchOriginalityReport,
} from "../../_lib/fetch-actions";

/** Loading step labels for the 4-stage risk analysis pipeline. */
const ANALYSIS_STEPS: LoadingStep[] = [
  { text: "Sorgu ve doğrulama parametreleri üretiliyor...", status: "idle" },
  {
    text: "Tavily ve Tezara paralel motorları koşturuluyor...",
    status: "idle",
  },
  {
    text: "Karşılaştırmalı literatür matrisi yapılandırılıyor...",
    status: "idle",
  },
  { text: "Nihai risk seviyesi ve tavsiyeler hazırlanıyor...", status: "idle" },
];

/** Loading step labels for the proceed-to-boxes orchestration. */
const PROCEED_STEPS: LoadingStep[] = [
  { text: "Konu kutuları oluşturuluyor...", status: "active" },
  { text: "Kutular sayfasına yönlendiriliyor...", status: "idle" },
];

/** Shape returned by {@link useRiskAnalysis}. */
export interface UseRiskAnalysisResult {
  /** True while the existing report (if any) is being loaded on mount. */
  loading: boolean;
  /** True while the 4-stage analysis pipeline is running. */
  analysing: boolean;
  /** User-safe error message, if any stage failed. */
  error: string | null;
  /** The latest originality report data, once available. */
  reportData: OriginalityReportData | null;
  /** True while the proceed flow is writing to DB (before box generation). */
  proceeding: boolean;
  /** Triggers the full 4-stage Tavily + Tezara + jury analysis pipeline. */
  startAnalysis: () => Promise<void>;
  /** Persists the report, generates boxes and navigates to the boxes step. */
  handleProceed: () => Promise<void>;
}

/**
 * Encapsulates the entire risk-stage orchestration for the onboarding flow:
 * initial data fetch, the 4-stage analysis pipeline (query extraction →
 * parallel search → sifting → jury analysis), loading-step bookkeeping,
 * and the proceed-to-boxes flow (persist report → generate boxes → navigate).
 *
 * The consuming component is responsible only for rendering the returned state.
 *
 * @returns Risk analysis state plus the two orchestration callbacks.
 */
export function useRiskAnalysis(): UseRiskAnalysisResult {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<OriginalityReportData | null>(
    null,
  );
  const [matrixData, setMatrixData] = useState<ThesisMatrix | null>(null);
  const [proceeding, setProceeding] = useState(false);

  const showLoading = useOnboardingStore((s) => s.showLoading);
  const hideLoading = useOnboardingStore((s) => s.hideLoading);
  const updateLoadingStep = useOnboardingStore((s) => s.updateLoadingStep);

  // Load existing report (and matrix) on mount.
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
        const tezara = report.tezaraResults;
        setReportData({
          originalityScore: tezara.riskPercentage,
          originalityBadge: tezara.originalityBadge,
          overlapAnalysis:
            tezara.overlapTable as OriginalityReportData["overlapAnalysis"],
          synthesisRoadmap: tezara.strategicRecommendations,
          tavilyResults:
            report.tavilyResults as OriginalityReportData["tavilyResults"],
          tezaraResults: tezara as OriginalityReportData["tezaraResults"],
        });
      } else if (!cancelled) {
        // DB cleaned (user went back and re-confirmed enrichment) — reset stale Zustand state
        useOnboardingStore.getState().resetStore();
      }
      if (!cancelled) setLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
    // router intentionally excluded — redirect on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Runs the 4-stage risk analysis: query/parameter generation, parallel
   * Tavily + Tezara search, comparative literature matrix construction, and
   * the final risk-level + recommendations synthesis. Updates the global
   * loading overlay step-by-step and stores the resulting report in state.
   */
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
          hideLoading();
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

      // ── Step 0: Extract queries ──
      const extractResult = await extractQueriesAction(matrixInput);
      if ("error" in extractResult) {
        setError(extractResult.error);
        hideLoading();
        setAnalysing(false);
        return;
      }
      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");

      // ── Step 1: Execute parallel searches ──
      const searchResult = await executeSearchAction({
        studyTitle: matrixInput.studyTitle,
        tavilyQueries: extractResult.data.tavilyQueries,
        tezaraQueries: extractResult.data.tezaraQueries,
      });
      if ("error" in searchResult) {
        setError(searchResult.error);
        hideLoading();
        setAnalysing(false);
        return;
      }
      updateLoadingStep(1, "completed");
      updateLoadingStep(2, "active");

      // ── Step 2: Sift theses ──
      const siftResult = await siftThesesAction({
        matrix: matrixInput,
        tezaraSearchResults: searchResult.data.tezaraSearchResults,
      });
      if ("error" in siftResult) {
        setError(siftResult.error);
        hideLoading();
        setAnalysing(false);
        return;
      }
      updateLoadingStep(2, "completed");
      updateLoadingStep(3, "active");

      // ── Step 3: Finalize jury analysis ──
      const juryResult = await finalizeJuryAnalysisAction({
        matrix: matrixInput,
        scrapedTheses: siftResult.data,
        tavilyResults: searchResult.data.tavilyResults,
      });
      if ("error" in juryResult) {
        setError(juryResult.error);
        hideLoading();
        setAnalysing(false);
        return;
      }
      updateLoadingStep(3, "completed");
      setReportData(juryResult.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Analiz sırasında bir hata oluştu.",
      );
    } finally {
      hideLoading();
      setAnalysing(false);
    }
  }, [matrixData, showLoading, hideLoading, updateLoadingStep]);

  // Auto-trigger analysis for first-time visitors (no existing report).
  useEffect(() => {
    if (!loading && !reportData && !analysing) {
      startAnalysis();
    }
  }, [loading, reportData, analysing, startAnalysis]);

  /**
   * Finalizes the risk stage: persists the report, generates the subject boxes
   * via Gemini, seeds them into the Zustand store and navigates to the boxes
   * step. Reports any failure via toast and falls back to a direct navigation.
   */
  const handleProceed = useCallback(async () => {
    setProceeding(true);

    const result = await completeRiskStageAction();
    if (result.error) {
      setProceeding(false);
      toast.error(result.error);
      return;
    }

    // DB done; now start Gemini box generation with GlobalLoader
    const steps = PROCEED_STEPS.map((s) => ({ ...s }));
    steps[0].status = "active";
    showLoading("İşlem Tamamlanıyor", "Konu kutuları yapılandırılıyor.", steps);

    try {
      const boxesResult = await generateBoxesAction();
      if ("error" in boxesResult) {
        hideLoading();
        toast.error(boxesResult.error);
        router.push("/onboarding/boxes");
        return;
      }

      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");

      useOnboardingStore.getState().setBoxes(boxesResult.boxes);
      hideLoading();
      router.push("/onboarding/boxes");
    } catch (err) {
      hideLoading();
      toast.error(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
    }
  }, [router, showLoading, hideLoading, updateLoadingStep]);

  return {
    loading,
    analysing,
    proceeding,
    error,
    reportData,
    startAnalysis,
    handleProceed,
  };
}
