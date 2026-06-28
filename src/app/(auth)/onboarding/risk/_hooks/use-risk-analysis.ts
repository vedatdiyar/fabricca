"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOnboardingNavigation } from "../../_hooks/use-onboarding-navigation";
import {
  fetchThesisMatrix,
  fetchOriginalityReport,
} from "../../_lib/fetch-actions";
import type { OriginalityReportData } from "@/lib/types";

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
 * fetching the existing report via TanStack Query, running the 4-stage
 * analysis pipeline via a mutation, and handling the proceed-to-boxes flow.
 *
 * The analysis pipeline writes to the DB first (inside finalizeJuryAnalysisAction),
 * then invalidates the TanStack Query cache so the UI seamlessly re-renders
 * from the fresh DB snapshot. No client-side persistence — the DB is always
 * the single source of truth.
 *
 * @returns Risk analysis state plus the two orchestration callbacks.
 */
export function useRiskAnalysis(): UseRiskAnalysisResult {
  const queryClient = useQueryClient();

  const { runRiskPipeline, proceedFromRisk } = useOnboardingNavigation();

  // Fetch existing report from DB. TanStack Query handles caching so
  // revisiting the page does not re-trigger the analysis.
  const {
    data: reportData,
    isLoading: loading,
    isFetching,
  } = useQuery({
    queryKey: ["originalityReport"],
    queryFn: async (): Promise<OriginalityReportData | null> => {
      const report = await fetchOriginalityReport();
      if (!report) return null;
      const tavilyResults = report.tavilyResults as {
        items: OriginalityReportData["tavilyResults"]["items"];
        briefingNote: string;
      };
      const tezaraResults = report.tezaraResults as {
        originalityBadge: OriginalityReportData["tezaraResults"]["originalityBadge"];
        overlapTable: OriginalityReportData["tezaraResults"]["overlapTable"];
        strategicRecommendations: OriginalityReportData["tezaraResults"]["strategicRecommendations"];
      };
      return {
        tavilyResults: {
          items: tavilyResults.items,
          briefingNote: tavilyResults.briefingNote,
        },
        tezaraResults: {
          originalityBadge: tezaraResults.originalityBadge,
          overlapTable: tezaraResults.overlapTable,
          strategicRecommendations:
            tezaraResults.strategicRecommendations,
        },
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Mutation: run the 4-stage analysis pipeline, which writes to DB
  // inside finalizeJuryAnalysisAction before returning.
  const {
    mutateAsync: startAnalysisInternal,
    isPending: analysing,
    error: analysisError,
    reset: resetAnalysisError,
  } = useMutation({
    mutationFn: async (): Promise<void> => {
      const matrix = await fetchThesisMatrix();
      if (!matrix) {
        throw new Error("Tez matrisi bulunamadı.");
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
          // Pipeline already handled cancellation (cleared DB, navigated).
          // Throw a sentinel so the mutation does not invalidate queries.
          throw new Error("__cancelled__");
        }
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      // Invalidate the report query so the UI re-renders from the fresh DB snapshot
      queryClient.invalidateQueries({ queryKey: ["originalityReport"] });
    },
  });

  const [proceeding, setProceeding] = useState(false);

  const handleProceed = useCallback(async () => {
    setProceeding(true);
    try {
      await proceedFromRisk();
    } finally {
      setProceeding(false);
    }
  }, [proceedFromRisk]);

  // Ref guards: ensure auto-trigger fires at most once and no two
  // analysis executions overlap.
  const hasFiredRef = useRef(false);
  const isExecutingRef = useRef(false);

  // Wrap startAnalysis to silence the cancellation sentinel and guard
  // against concurrent invocations from React strict-mode double-mount
  // or reference-drift re-renders.
  const startAnalysis = useCallback(async () => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    resetAnalysisError();
    try {
      await startAnalysisInternal();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      if (message === "__cancelled__") {
        // Cancellation is not an error — already handled by the pipeline
        return;
      }
      // Real error — let it surface through mutation state
    } finally {
      isExecutingRef.current = false;
    }
  }, [startAnalysisInternal, resetAnalysisError]);

  // Auto-trigger analysis exactly once on mount when no report exists yet.
  useEffect(() => {
    if (hasFiredRef.current) return;
    if (loading || isFetching) return;
    if (reportData) return;

    hasFiredRef.current = true;
    startAnalysis();
  }, [loading, isFetching, reportData, startAnalysis]);

  return {
    loading,
    analysing,
    proceeding,
    error:
      analysisError instanceof Error && analysisError.message !== "__cancelled__"
        ? analysisError.message
        : null,
    reportData: reportData ?? null,
    startAnalysis,
    handleProceed,
  };
}
