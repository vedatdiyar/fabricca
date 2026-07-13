"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOnboardingNavigation } from "../../_hooks/use-onboarding-navigation";
import {
  fetchThesisMatrix,
  fetchOriginalityReport,
} from "../../_services/fetch-actions";
import type { OriginalityReportData } from "@/lib/types";

/** Shape returned by {@link useRiskAnalysis}. */
export interface UseRiskAnalysisResult {
  /** True while the existing report (if any) is being loaded on mount. */
  loading: boolean;
  /** User-safe error message, if any stage failed. */
  error: string | null;
  /** The latest originality report data, once available. */
  reportData: OriginalityReportData | null;
  /** True while the proceed flow is writing to DB (before box generation). */
  proceeding: boolean;
  /** Triggers the full 4-stage Tezara + jury analysis pipeline. */
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
  const analysisStarted = useRef(false);

  const { runRiskPipeline, proceedFromRisk } = useOnboardingNavigation();

  // Fetch existing report from DB. TanStack Query handles caching so
  // revisiting the page does not re-trigger the analysis.
  const { data: reportData, isLoading: loading } = useQuery({
    queryKey: ["originalityReport"],
    queryFn: async (): Promise<OriginalityReportData | null> => {
      const report = await fetchOriginalityReport();
      if (!report) return null;
      return {
        tezaraResults: report.tezaraResults,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Mutation: run the 4-stage analysis pipeline, which writes to DB
  // inside finalizeJuryAnalysisAction before returning.
  const {
    mutateAsync: startAnalysisInternal,
    error: analysisError,
    reset: resetAnalysisError,
  } = useMutation({
    mutationFn: async (): Promise<void> => {
      const matrix = await fetchThesisMatrix();
      if (!matrix) {
        throw new Error("Thesis matrix not found.");
      }

      const matrixInput = {
        mainActors: matrix.mainActors,
        researchFocus: matrix.researchFocus,
        temporalScope: matrix.temporalScope,
        spatialScope: matrix.spatialScope,
        theoreticalFramework: matrix.theoreticalFramework,
        methodology: matrix.methodology,
        mainClaim: matrix.mainClaim,
      };

      const result = await runRiskPipeline(matrixInput);
      if (result.error) {
        if (result.error === "cancelled") {
          // Pipeline already handled cancellation (cleared DB, navigated).
          // Silent return — mutation succeeds without invalidating queries.
          return;
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

  const startAnalysis = useCallback(async () => {
    resetAnalysisError();
    await startAnalysisInternal();
  }, [startAnalysisInternal, resetAnalysisError]);

  // Auto-trigger: when the initial DB fetch completes without a cached
  // report and no error, start the 4-stage analysis pipeline.
  useEffect(() => {
    if (!loading && !reportData && !analysisError) {
      if (!analysisStarted.current) {
        analysisStarted.current = true;
        startAnalysis();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, reportData, startAnalysis]);

  return {
    loading,
    proceeding,
    error: analysisError instanceof Error ? analysisError.message : null,
    reportData: reportData ?? null,
    startAnalysis,
    handleProceed,
  };
}
