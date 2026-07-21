"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLoadingOverlay } from "@/providers/loading-overlay-provider";
import {
  ANALYSIS_STEPS,
  PROCEED_STEPS,
  LITERATURE_PIPELINE_STEPS,
  STEP_MIN_DURATION_MS,
  isNavigationStepText,
} from "../_lib/loading-steps";
import type {
  OriginalityReportData,
  ThesisMatrix,
  LiteraturePoolEntry,
  JuryArticle,
} from "@/lib/types";
import { getStepTanStackKeys } from "@/lib/onboarding-cache";
import { clearDownstreamDbAction } from "@/app/(onboarding)/onboarding/actions";
import {
  extractQueriesAction,
  executeSearchAndSiftAction,
  finalizeJuryAnalysisAction,
} from "../risk/actions";
import {
  generateBoxesStructureAction,
  confirmBoxesAction,
} from "../boxes/actions";
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

interface MatrixInput {
  researchCore: string;
  targetActors: string;
  context: string;
  framework: string;
  mainClaim: string;
}

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
    async (index: number, steps: typeof ANALYSIS_STEPS): Promise<void> => {
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
   * Runs the full 4-stage risk analysis pipeline (query extraction →
   * Tezara search → thesis sifting → jury analysis + DB persist).
   * Manages the global loading overlay step-by-step.
   *
   * @param matrixInput - The current thesis matrix values.
   * @returns The originality report on success, or an error string.
   */
  const runRiskPipeline = useCallback(
    async (
      matrixInput: MatrixInput,
    ): Promise<{ data?: OriginalityReportData | null; error?: string }> => {
      const steps = ANALYSIS_STEPS.map((s) => ({ ...s }));
      steps[0].status = "active";

      let isCancelled = false;

      showLoading(
        "Risk Analiz Motorları Çalışıyor",
        "Yapay zeka asistanınız çalışma matrisinizi inceliyor, veri tabanlarını tarıyor ve risk raporunu hazırlıyor.",
        steps,
        () => {
          isCancelled = true;
          void clearDownstreamDbAction("risk").then(() => {
            const keys = getStepTanStackKeys("risk");
            for (const key of keys)
              queryClient.removeQueries({ queryKey: key });
          });
          toast.info("İşlem iptal edildi.");
        },
      );

      // Cache invalidation: submitMatrix already purged downstream data,
      // but the TQ client cache may still hold stale data.
      const matrixTqKeys = getStepTanStackKeys("matrix");
      for (const key of matrixTqKeys)
        queryClient.invalidateQueries({ queryKey: key });

      try {
        const extractResult = await extractQueriesAction(matrixInput);
        if (isCancelled) return { error: "cancelled" };
        if ("error" in extractResult) {
          hideLoading();
          return { error: extractResult.error };
        }
        await completeStep(0, steps);

        const searchAndSiftResult = await executeSearchAndSiftAction({
          matrix: matrixInput,
          tezaraQueries: extractResult.data.tezaraQueries,
        });
        if (isCancelled) return { error: "cancelled" };
        if ("error" in searchAndSiftResult) {
          hideLoading();
          return { error: searchAndSiftResult.error };
        }
        await completeStep(1, steps);
        await completeStep(2, steps);

        const juryResult = await finalizeJuryAnalysisAction({
          matrix: matrixInput,
          selectedTheses: searchAndSiftResult.data.selected,
        });
        if (isCancelled) return { error: "cancelled" };
        if ("error" in juryResult) {
          hideLoading();
          return { error: juryResult.error };
        }
        await completeStep(3, steps);
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
    [showLoading, hideLoading, completeStep, queryClient],
  );

  /**
   * Finalizes the risk stage: persists the report status, generates the
   * subject boxes via Gemini, persists the boxes to the database immediately,
   * seeds the boxes into the TanStack Query cache, and navigates to the boxes
   * step.  Reports any failure via toast.
   *
   * NOTE: hideLoading is intentionally NOT called before router.push so the
   * loading overlay stays visible through the navigation. The target page's
   * hook is responsible for hiding it.
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
          const keys = getStepTanStackKeys("risk");
          for (const key of keys) queryClient.removeQueries({ queryKey: key });
        });
        toast.info("İşlem iptal edildi.");
      },
    );

    try {
      if (isCancelled) return { success: false };

      const structResult = await generateBoxesStructureAction();
      if (isCancelled) return { success: false };
      if ("error" in structResult) {
        hideLoading();
        toast.error(structResult.error);
        return { success: false };
      }

      await completeStep(0, steps);

      if (isCancelled) return { success: false };

      // Persist generated boxes to DB immediately
      const saveResult = await confirmBoxesAction(structResult.boxes);
      if (isCancelled) return { success: false };
      if ("error" in saveResult) {
        hideLoading();
        toast.error(saveResult.error);
        return { success: false };
      }

      // Seed boxes into TanStack Query cache and do not invalidate it to avoid refetching stale cache
      queryClient.setQueryData(["boxes"], structResult.boxes);

      // Invalidate stepper query to reflect step progress
      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });

      if (isCancelled) return { success: false };

      // Hide loading spinner deterministically before pushing
      hideLoading();
      window.location.href = "/onboarding/boxes";

      return { success: true };
    } catch (err) {
      if (isCancelled) return { success: false };
      hideLoading();
      toast.error(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
      return { success: false };
    }
  }, [showLoading, hideLoading, completeStep, queryClient]);

  /**
   * Saves the thesis matrix to the database, purges downstream data,
   * runs the risk analysis pipeline sequentially, and then navigates
   * to the risk analysis page.
   *
   * @param matrixInput - The thesis matrix fields to persist.
   */
  const submitMatrix = useCallback(
    async (
      matrixInput: ThesisMatrix,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        // Step 1: Downstream cleanup
        const clearResult = await clearDownstreamDbAction("matrix");
        if ("error" in clearResult) {
          toast.error(clearResult.error);
          return { success: false, error: clearResult.error };
        }

        // Step 2: Persist matrix
        const saveResult = await saveThesisMatrixAction(matrixInput);
        if ("error" in saveResult) {
          toast.error(saveResult.error);
          return { success: false, error: saveResult.error };
        }

        // Step 3: Run risk analysis pipeline
        const cleanMatrixInput = {
          researchCore: matrixInput.researchCore,
          targetActors: matrixInput.targetActors,
          context: matrixInput.context,
          framework: matrixInput.framework,
          mainClaim: matrixInput.mainClaim,
        };
        const riskResult = await runRiskPipeline(cleanMatrixInput);
        if (riskResult.error) {
          return { success: false, error: riskResult.error };
        }

        // Step 4: Cache update and navigation
        if (riskResult.data) {
          queryClient.setQueryData(["originalityReport"], riskResult.data);
        }
        queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });

        router.push("/onboarding/risk");

        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [router, queryClient, runRiskPipeline],
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
    runRiskPipeline,
    proceedFromRisk,
    submitMatrix,
    proceedFromBoxes,
    runLiteraturePipeline,
    finalizeLiterature,
  };
}
