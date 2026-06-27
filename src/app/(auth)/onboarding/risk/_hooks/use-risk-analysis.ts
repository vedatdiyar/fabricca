"use client";

import { useEffect, useCallback, useReducer } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { OriginalityReportData } from "@/lib/types";
import type { ThesisMatrix } from "@/db/schema";
import {
  fetchThesisMatrix,
  fetchOriginalityReport,
} from "../../_lib/fetch-actions";
import { useOnboardingNavigation } from "../../_hooks/use-onboarding-navigation";
import { clearDownstreamDbAction } from "@/app/(auth)/onboarding/actions";

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
type State = {
  loading: boolean;
  analysing: boolean;
  proceeding: boolean;
  error: string | null;
  reportData: OriginalityReportData | null;
  matrixData: ThesisMatrix | null;
};

const initialState: State = {
  loading: true,
  analysing: false,
  proceeding: false,
  error: null,
  reportData: null,
  matrixData: null,
};

type Action =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ANALYSING"; payload: boolean }
  | { type: "SET_PROCEDING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_REPORT_DATA"; payload: OriginalityReportData | null }
  | { type: "SET_MATRIX_DATA"; payload: ThesisMatrix | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ANALYSING":
      return { ...state, analysing: action.payload };
    case "SET_PROCEDING":
      return { ...state, proceeding: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_REPORT_DATA":
      return { ...state, reportData: action.payload };
    case "SET_MATRIX_DATA":
      return { ...state, matrixData: action.payload };
    default:
      return state;
  }
}

export function useRiskAnalysis(): UseRiskAnalysisResult {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);

  const { runRiskPipeline, proceedFromRisk } = useOnboardingNavigation();

  // Load existing report (and matrix) on mount.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Reset proceeding flag on any mount — protects against stale BF Cache
      dispatch({ type: "SET_PROCEDING", payload: false });

      // 1) Check Zustand cache first — avoids redundant DB reads and prevents
      //    the auto-trigger from re-running analysis after enrichment.
      const cachedReport = useOnboardingStore.getState().reportData;
      if (cachedReport && !cancelled) {
        dispatch({ type: "SET_REPORT_DATA", payload: cachedReport });
        const matrix = await fetchThesisMatrix();
        if (matrix) dispatch({ type: "SET_MATRIX_DATA", payload: matrix });
        if (!cancelled) dispatch({ type: "SET_LOADING", payload: false });
        return;
      }

      const matrix = await fetchThesisMatrix();
      if (!matrix) {
        toast.error("Tez matrisi bulunamadı.");
        router.push("/onboarding/matrix");
        return;
      }
      dispatch({ type: "SET_MATRIX_DATA", payload: matrix });

      const report = await fetchOriginalityReport();
      if (report && !cancelled) {
        dispatch({
          type: "SET_REPORT_DATA",
          payload: {
            tavilyResults: {
              items: report.tavilyResults
                .items as OriginalityReportData["tavilyResults"]["items"],
              briefingNote: report.tavilyResults.briefingNote,
            },
            tezaraResults: {
              originalityBadge: report.tezaraResults.originalityBadge,
              overlapTable: report.tezaraResults.overlapTable,
              strategicRecommendations:
                report.tezaraResults.strategicRecommendations,
            },
          },
        });
      } else if (!cancelled) {
        useOnboardingStore.getState().resetStore();
      }
      if (!cancelled) dispatch({ type: "SET_LOADING", payload: false });
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Runs the 4-stage risk analysis via the central onboarding orchestrator.
   * Delegates loading overlay management to the orchestrator; only manages
   * local state transitions (analysing flag, error, report data).
   */
  const startAnalysis = useCallback(async () => {
    dispatch({ type: "SET_ANALYSING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      let matrix = state.matrixData;
      if (!matrix) {
        matrix = await fetchThesisMatrix();
        if (!matrix) {
          dispatch({ type: "SET_ERROR", payload: "Tez matrisi bulunamadı." });
          dispatch({ type: "SET_ANALYSING", payload: false });
          return;
        }
      }

      const matrixInput = {
        studyTitle: matrix.studyTitle,
        researchQuestion: matrix.researchQuestion,
        mainClaim: matrix.mainClaim,
        theoreticalFramework: matrix.theoreticalFramework,
        methodology: matrix.methodology,
        researchScope: matrix.researchScope,
      };

      const result = await runRiskPipeline(matrixInput);
      if (result.error) {
        if (result.error === "cancelled") {
          // Clears risk, boxes, literature-review step completion and reportData
          useOnboardingStore.getState().clearDownstreamData("enrichment");
          void clearDownstreamDbAction("enrichment");
          toast.info("İşlem iptal edildi, önceki adıma yönlendiriliyorsunuz.");
          router.push("/onboarding/enrichment");
        } else {
          dispatch({ type: "SET_ERROR", payload: result.error });
        }
      } else if (result.data) {
        dispatch({ type: "SET_REPORT_DATA", payload: result.data });
      }
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload:
          err instanceof Error
            ? err.message
            : "Analiz sırasında bir hata oluştu.",
      });
    } finally {
      dispatch({ type: "SET_ANALYSING", payload: false });
    }
  }, [state.matrixData, runRiskPipeline, router]);

  // Auto-trigger analysis only when there really is no report anywhere
  // (Zustand cache, DB or in-memory state).
  useEffect(() => {
    const hasCache = !!useOnboardingStore.getState().reportData;
    if (
      !state.loading &&
      !state.reportData &&
      !state.analysing &&
      !state.error &&
      !hasCache
    ) {
      void Promise.resolve().then(() => {
        startAnalysis();
      });
    }
  }, [
    state.loading,
    state.reportData,
    state.analysing,
    state.error,
    startAnalysis,
  ]);

  /**
   * Finalizes the risk stage via the central onboarding orchestrator:
   * persists the report, generates the subject boxes, seeds them into
   * the Zustand store and navigates to the boxes step.
   */
  const handleProceed = useCallback(async () => {
    dispatch({ type: "SET_PROCEDING", payload: true });
    try {
      await proceedFromRisk();
      dispatch({ type: "SET_PROCEDING", payload: false });
    } catch {
      dispatch({ type: "SET_PROCEDING", payload: false });
    }
  }, [proceedFromRisk]);

  return {
    loading: state.loading,
    analysing: state.analysing,
    proceeding: state.proceeding,
    error: state.error,
    reportData: state.reportData,
    startAnalysis,
    handleProceed,
  };
}
