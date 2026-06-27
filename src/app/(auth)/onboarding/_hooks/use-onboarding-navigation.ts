"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLoadingOverlay } from "@/components/providers/loading-overlay-provider";
import type { LoadingStep } from "@/components/providers/loading-overlay-provider";
import type { OriginalityReportData } from "@/lib/types";
import { clearDownstreamDbAction } from "@/app/(auth)/onboarding/actions";
import {
  extractQueriesAction,
  executeSearchAction,
  siftThesesAction,
  finalizeJuryAnalysisAction,
  completeRiskStageAction,
} from "../risk/actions";
import {
  generateBoxesStructureAction,
  mineFoundationalQueriesAction,
  prefetchLiteratureCacheAction,
} from "../boxes/actions";

interface MatrixInput {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  mainClaim: string;
}

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

const PROCEED_STEPS: LoadingStep[] = [
  {
    text: "Tez matrisi analiz edilerek konu kutuları yapılandırılıyor...",
    status: "active",
  },
  {
    text: "Konu kutuları için akademik veri tabanlarında kurucu eserler aranıyor...",
    status: "idle",
  },
  { text: "Kutular sayfasına yönlendiriliyor...", status: "idle" },
];

/**
 * Central onboarding orchestrator hook that coordinates cross-feature flows
 * (risk pipeline → boxes generation).
 *
 * UI components should import this hook instead of directly importing
 * actions from other feature folders, preserving feature isolation.
 */
export function useOnboardingNavigation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showLoading, hideLoading, updateLoadingStep } = useLoadingOverlay();

  /**
   * Runs the full 4-stage risk analysis pipeline (query extraction →
   * parallel Tavily/Tezara search → thesis sifting → jury analysis + DB persist).
   * Manages the global loading overlay step-by-step.
   *
   * @param matrixInput - The current thesis matrix values.
   * @returns The originality report on success, or an error string.
   */
  const runRiskPipeline = useCallback(
    async (
      matrixInput: MatrixInput,
    ): Promise<{ data?: OriginalityReportData; error?: string }> => {
      const steps = ANALYSIS_STEPS.map((s) => ({ ...s }));
      steps[0].status = "active";

      let isCancelled = false;

      showLoading(
        "Risk Analiz Motorları Çalışıyor",
        "Yapay zeka asistanınız tez matrisinizi inceliyor, veri tabanlarını tarıyor ve risk raporunu hazırlıyor.",
        steps,
        () => {
          isCancelled = true;
          void clearDownstreamDbAction("matrix").then(() => {
            queryClient.invalidateQueries();
          });
          toast.info("İşlem iptal edildi.");
        },
      );

      try {
        const extractResult = await extractQueriesAction(matrixInput);
        if (isCancelled) return { error: "cancelled" };
        if ("error" in extractResult) {
          hideLoading();
          return { error: extractResult.error };
        }
        updateLoadingStep(0, "completed");
        updateLoadingStep(1, "active");

        const searchResult = await executeSearchAction({
          studyTitle: matrixInput.studyTitle,
          tavilyQueries: extractResult.data.tavilyQueries,
          tezaraQueries: extractResult.data.tezaraQueries,
        });
        if (isCancelled) return { error: "cancelled" };
        if ("error" in searchResult) {
          hideLoading();
          return { error: searchResult.error };
        }
        updateLoadingStep(1, "completed");
        updateLoadingStep(2, "active");

        const siftResult = await siftThesesAction({
          matrix: matrixInput,
          tezaraSearchResults: searchResult.data.tezaraSearchResults,
        });
        if (isCancelled) return { error: "cancelled" };
        if ("error" in siftResult) {
          hideLoading();
          return { error: siftResult.error };
        }
        updateLoadingStep(2, "completed");
        updateLoadingStep(3, "active");

        const juryResult = await finalizeJuryAnalysisAction({
          matrix: matrixInput,
          scrapedTheses: siftResult.data,
          tavilyResults: searchResult.data.tavilyResults,
        });
        if (isCancelled) return { error: "cancelled" };
        if ("error" in juryResult) {
          hideLoading();
          return { error: juryResult.error };
        }
        updateLoadingStep(3, "completed");
        hideLoading();

        return { data: juryResult.data };
      } catch (err) {
        if (isCancelled) return { error: "cancelled" };
        hideLoading();
        return {
          error:
            err instanceof Error
              ? err.message
              : "Analiz sırasında bir hata oluştu.",
        };
      }
    },
    [showLoading, hideLoading, updateLoadingStep, queryClient],
  );

  /**
   * Finalizes the risk stage: persists the report status, generates the
   * subject boxes via Gemini, mines foundational queries via OpenAlex, seeds
   * the boxes into the TanStack Query cache, and navigates to the boxes step.
   * Reports any failure via toast.
   */
  const proceedFromRisk = useCallback(async (): Promise<{
    success: boolean;
  }> => {
    const steps = PROCEED_STEPS.map((s) => ({ ...s }));
    steps[0].status = "active";

    let isCancelled = false;

    showLoading(
      "İşlem Tamamlanıyor",
      "Konu kutuları yapılandırılıyor.",
      steps,
      () => {
        isCancelled = true;
        void clearDownstreamDbAction("risk").then(() => {
          queryClient.invalidateQueries();
        });
        toast.info("İşlem iptal edildi.");
      },
    );

    try {
      const stageResult = await completeRiskStageAction();
      if (isCancelled) return { success: false };
      if (stageResult.error) {
        hideLoading();
        toast.error(stageResult.error);
        return { success: false };
      }

      const structResult = await generateBoxesStructureAction();
      if (isCancelled) return { success: false };
      if ("error" in structResult) {
        hideLoading();
        toast.error(structResult.error);
        return { success: false };
      }

      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");

      const mineResult = await mineFoundationalQueriesAction(
        structResult.boxes,
      );
      if (isCancelled) return { success: false };
      if ("error" in mineResult) {
        hideLoading();
        toast.error(mineResult.error);
        return { success: false };
      }

      updateLoadingStep(1, "completed");
      updateLoadingStep(2, "active");

      if (isCancelled) return { success: false };

      // Seed boxes into TanStack Query cache
      queryClient.setQueryData(["boxes"], mineResult.boxes);

      // Invalidate onboarding-steps so the stepper reflects the new state
      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });

      // Fire-and-forget: pre-fetch full literature cache in the background
      // while the user views their boxes. The cache will be ready by the time
      // they reach the literature-review step.
      prefetchLiteratureCacheAction(mineResult.boxes).then((res) => {
        if (res?.cachedPapers) {
          queryClient.setQueryData(["cachedPapers"], res.cachedPapers);
        }
      });

      // Brief delay to allow loading step transition to be seen
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (isCancelled) return { success: false };
      hideLoading();
      router.push("/onboarding/boxes");

      return { success: true };
    } catch (err) {
      if (isCancelled) return { success: false };
      hideLoading();
      toast.error(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
      return { success: false };
    }
  }, [router, showLoading, hideLoading, updateLoadingStep, queryClient]);

  return { runRiskPipeline, proceedFromRisk };
}
