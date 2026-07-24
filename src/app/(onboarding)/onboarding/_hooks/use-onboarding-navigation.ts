"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLoadingOverlay } from "@/providers/loading-overlay-provider";
import {
  MATRIX_SUBMIT_STEPS,
  LITERATURE_PIPELINE_STEPS,
  POSITIONING_PIPELINE_STEPS,
  STEP_MIN_DURATION_MS,
  isNavigationStepText,
  type LoadingStep,
} from "../_lib/loading-steps";
import type {
  ThesisMatrix,
  LiteraturePoolEntry,
  JuryArticle,
} from "@/lib/types";
import { getStepTanStackKeys } from "@/lib/onboarding-cache";
import { clearDownstreamDbAction } from "@/app/(onboarding)/onboarding/actions";
import { saveThesisMatrixAction } from "../matrix/actions";
import { fetchBoxesWithFullShape } from "../_services/fetch-actions";
import {
  fetchPreloadedLiteraturePool,
  processAllBoxesAction,
  confirmLiteratureAction,
  appendArchiveEntriesAction,
  finalizeOnboardingAction,
  setLiteratureCancelledAction,
} from "../literature-review/actions";
import type { SubBoxInput } from "../literature-review/_services/literature-review-papers";
import { runPositioningPipelineAction } from "../positioning/actions";
import type { PositioningMatrixInput } from "../positioning/_lib/validation";
import type { JuryAnalysisResult } from "../positioning/_services/analysis";

/**
 * Central onboarding orchestrator hook that coordinates all cross-feature
 * flows (matrix → risk → boxes → literature → finalize) under a single
 * standard architecture:
 *
 *   showLoading() → Server Actions → updateLoadingStep() → router.push()
 *   (hideLoading is never called mid-step; the target page hides it)
 *
 * All functions share:
 *   - isCancelled flag + cancel callback for early termination
 *   - updateLoadingStep for per-step progress
 *   - try-catch with toast.error for user-facing errors
 */
export function useOnboardingNavigation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showLoading, hideLoading, updateLoadingStep } = useLoadingOverlay();

  const stepActiveSinceRef = useRef<Map<number, number>>(new Map());

  const completeStep = useCallback(
    async (index: number, steps: LoadingStep[]): Promise<void> => {
      const isNav = isNavigationStepText(steps[index].text);
      if (!isNav) {
        const activated = stepActiveSinceRef.current.get(index) ?? Date.now();
        const elapsed = Date.now() - activated;
        const remaining = STEP_MIN_DURATION_MS - elapsed;
        if (remaining > 0) {
          await new Promise<void>((r) => setTimeout(r, remaining));
        }
        stepActiveSinceRef.current.delete(index);
      }
      updateLoadingStep(index, "completed");
      let next = index + 1;
      while (next < steps.length) {
        updateLoadingStep(next, "active");
        stepActiveSinceRef.current.set(next, Date.now());
        if (!isNavigationStepText(steps[next].text)) break;
        updateLoadingStep(next, "completed");
        stepActiveSinceRef.current.delete(next);
        next++;
      }
    },
    [updateLoadingStep],
  );

  /**
   * Saves the thesis matrix to the database, runs the positioning AI pipeline
   * (query generation → Tezara search → Cohere rerank → jury analysis),
   * and navigates to the positioning report page.
   *
   * @param matrixInput - The thesis matrix fields to persist.
   */
  const submitMatrix = useCallback(
    async (
      matrixInput: ThesisMatrix,
    ): Promise<{ success: boolean; error?: string }> => {
      const steps = MATRIX_SUBMIT_STEPS.map((s) => ({ ...s }));
      steps[0].status = "active";

      showLoading(
        "Çalışma Matrisi Kaydediliyor & Konumlandırma Analizi Çalıştırılıyor",
        "Tez matrisiniz kaydediliyor, akademik arama sorguları üretiliyor ve jüri analizi yapılıyor.",
        steps,
      );

      try {
        const clearResult = await clearDownstreamDbAction("matrix");
        if ("error" in clearResult) {
          hideLoading();
          toast.error(clearResult.error);
          return { success: false, error: clearResult.error };
        }

        await completeStep(0, steps);

        const saveResult = await saveThesisMatrixAction(matrixInput);
        if ("error" in saveResult) {
          hideLoading();
          toast.error(saveResult.error);
          return { success: false, error: saveResult.error };
        }

        const positioningInput: PositioningMatrixInput = {
          subjectAndProblem: matrixInput.researchCore,
          theoreticalFramework: matrixInput.framework,
          unitOfAnalysis: matrixInput.targetActors,
          methodology: matrixInput.mainClaim,
          scopeAndContext: matrixInput.context,
        };

        const pipelineRes =
          await runPositioningPipelineAction(positioningInput);
        if ("error" in pipelineRes) {
          hideLoading();
          toast.error(pipelineRes.error);
          return { success: false, error: pipelineRes.error };
        }

        await completeStep(1, steps);
        await completeStep(2, steps);
        await completeStep(3, steps);

        queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });

        hideLoading();
        router.push("/onboarding/positioning");

        return { success: true };
      } catch (err) {
        hideLoading();
        const message =
          err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [router, queryClient, showLoading, hideLoading, completeStep],
  );

  /**
   * Runs the full literature review AI pipeline: checks for a pre-existing
   * pool in the database; if none exists, runs the batch AI search across
   * all sub-boxes, persists the results via confirmLiteratureAction, and
   * returns the literature pool.  Hides the loading overlay on completion
   * or error.
   *
   * @param subBoxInputs - The sub-box inputs to feed to the AI pipeline.
   * @returns The literature pool entries on success, or an error string.
   */
  const runLiteraturePipeline = useCallback(
    async (
      subBoxInputs: SubBoxInput[],
    ): Promise<{ data?: LiteraturePoolEntry[]; error?: string }> => {
      const steps = LITERATURE_PIPELINE_STEPS.map((s) => ({ ...s }));
      steps[0].status = "active";

      let isCancelled = false;

      showLoading(
        "Literatür Taraması Yapılıyor",
        "Yapay zeka asistanınız her bir konu kutusu için akademik kaynakları tarıyor.",
        steps,
        () => {
          isCancelled = true;
          void setLiteratureCancelledAction();
          void clearDownstreamDbAction("boxes").then(() => {
            const keys = getStepTanStackKeys("boxes");
            for (const key of keys)
              queryClient.removeQueries({ queryKey: key });
          });
          toast.info("Literatür taraması iptal edildi.");
          router.push("/onboarding/boxes");
        },
      );

      try {
        // Step 1: Check for pre-existing pool
        const existing = await fetchPreloadedLiteraturePool();
        if (isCancelled) return { error: "cancelled" };

        if (existing.data && existing.data.length > 0) {
          updateLoadingStep(0, "completed");
          updateLoadingStep(1, "completed");
          updateLoadingStep(2, "completed");
          hideLoading();
          return { data: existing.data };
        }

        await completeStep(0, steps);

        // Step 2: AI pipeline
        const processResult = await processAllBoxesAction(subBoxInputs);
        if (isCancelled) return { error: "cancelled" };
        if ("error" in processResult) {
          hideLoading();
          return { error: processResult.error };
        }

        await completeStep(1, steps);

        // Step 3: Confirm and persist results
        const confirmResult = await confirmLiteratureAction({
          literaturePool: processResult.data!,
        });
        if (isCancelled) return { error: "cancelled" };
        if ("error" in confirmResult) {
          hideLoading();
          return { error: confirmResult.error };
        }

        await completeStep(2, steps);
        hideLoading();

        return { data: processResult.data! };
      } catch (err) {
        if (isCancelled) return { error: "cancelled" };
        hideLoading();
        return {
          error:
            err instanceof Error
              ? err.message
              : "Literatür taraması sırasında bir hata oluştu.",
        };
      }
    },
    [
      router,
      showLoading,
      hideLoading,
      completeStep,
      updateLoadingStep,
      queryClient,
    ],
  );

  /**
   * Clears downstream data for the boxes step, runs the literature review
   * AI pipeline, and then navigates to the literature review page.
   */
  const proceedFromBoxes = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      // Step 1: Downstream cleanup
      const clearResult = await clearDownstreamDbAction("boxes");
      if ("error" in clearResult) {
        toast.error(clearResult.error);
        return { success: false, error: clearResult.error };
      }

      const boxesTqKeys = getStepTanStackKeys("boxes");
      for (const key of boxesTqKeys)
        queryClient.invalidateQueries({ queryKey: key });

      // Step 2: Fetch boxes
      const boxes = await fetchBoxesWithFullShape();
      const subBoxInputs: SubBoxInput[] = boxes.map((box) => ({
        id: box.id ?? 0,
        title: box.title,
        description: box.description,
        boxType: box.boxType,
        subBoxes: (box.subBoxes ?? []).map((sb) => ({
          title: sb.title,
          thesisBoxId: sb.id ?? 0,
          semanticQuery: sb.semanticQuery ?? "",
          foundationalQueries: sb.foundationalQueries ?? [],
        })),
        foundationalQueries: (box.subBoxes ?? []).flatMap(
          (sb) => sb.foundationalQueries ?? [],
        ),
      }));

      // Step 3: Run literature review pipeline
      const litResult = await runLiteraturePipeline(subBoxInputs);
      if (litResult.error) {
        return { success: false, error: litResult.error };
      }

      // Step 4: Navigation
      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });
      if (litResult.data) {
        queryClient.setQueryData(["literature-pool"], litResult.data);
      }

      hideLoading();
      window.location.href = "/onboarding/literature-review";

      return { success: true };
    } catch (err) {
      hideLoading();
      const message =
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
      toast.error(message);
      return { success: false, error: message };
    }
  }, [queryClient, runLiteraturePipeline, hideLoading]);

  /**
   * Runs the full positioning pipeline: clears downstream data, generates search
   * queries, sifts theses, runs jury analysis, and persists the report.
   * Shows the global loading overlay with step progress during execution.
   *
   * @param matrixInput - The validated 5-field positioning matrix input.
   * @returns The analysis report on success, or an error string.
   */
  const submitPositioning = useCallback(
    async (
      matrixInput: PositioningMatrixInput,
    ): Promise<{
      success: boolean;
      report?: JuryAnalysisResult;
      error?: string;
    }> => {
      const steps = POSITIONING_PIPELINE_STEPS.map((s) => ({ ...s }));
      steps[0].status = "active";

      showLoading(
        "Konumlandırma Analizi Çalıştırılıyor",
        "Arama sorguları üretiliyor, tezler süzülüyor ve jüri değerlendirmesi yapılıyor.",
        steps,
      );

      try {
        const clearResult = await clearDownstreamDbAction("positioning");
        if ("error" in clearResult) {
          hideLoading();
          toast.error(clearResult.error);
          return { success: false, error: clearResult.error };
        }

        await completeStep(0, steps);

        const res = await runPositioningPipelineAction(matrixInput);
        if ("error" in res) {
          hideLoading();
          toast.error(res.error);
          return { success: false, error: res.error };
        }

        await completeStep(1, steps);
        await completeStep(2, steps);

        queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });
        hideLoading();

        return { success: true, report: res.report };
      } catch (err) {
        hideLoading();
        const message =
          err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [showLoading, hideLoading, completeStep, queryClient],
  );

  /**
   * Confirms the positioning report and navigates to the boxes step.
   */
  const proceedFromPositioning = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });
    toast.success("Konumlandırma onaylandı. Konu kutuları oluşturuluyor...");
    router.push("/onboarding/boxes");
  }, [router, queryClient]);

  /**
   * Finalizes the onboarding process: persists any manual archive entries,
   * sets the onboardingCompleted flag, invalidates all caches, and navigates
   * to the dashboard.  No loading overlay — caller (literature review page)
   * handles the button's disabled/spinner state.
   *
   * @param archiveEntries - Manual archive entries (empty array if none).
   */
  const finalizeLiterature = useCallback(
    async (
      archiveEntries: {
        subBoxTitle: string;
        thesisBoxId: number;
        articles: JuryArticle[];
      }[],
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (archiveEntries.length > 0) {
          const archiveResult = await appendArchiveEntriesAction({
            entries: archiveEntries,
          });
          if ("error" in archiveResult && archiveResult.error) {
            toast.error(archiveResult.error);
            return { success: false, error: archiveResult.error };
          }
        }

        const finalizeResult = await finalizeOnboardingAction();
        if ("error" in finalizeResult && finalizeResult.error) {
          toast.error(finalizeResult.error);
          return { success: false, error: finalizeResult.error };
        }

        queryClient.invalidateQueries();
        toast.success("Tebrikler! Onboarding süreciniz tamamlandı.");
        window.location.href = "/dashboard";

        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [queryClient],
  );

  return {
    submitMatrix,
    submitPositioning,
    proceedFromBoxes,
    runLiteraturePipeline,
    proceedFromPositioning,
    finalizeLiterature,
  };
}
