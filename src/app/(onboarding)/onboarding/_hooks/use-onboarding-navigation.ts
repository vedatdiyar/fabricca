"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLoadingOverlay } from "@/providers/loading-overlay-provider";
import {
  MATRIX_SUBMIT_STEPS,
  BOX_GENERATION_STEPS,
  LITERATURE_PIPELINE_STEPS,
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
  generateAndMapBoxesAction,
  persistBoxesAction,
} from "../boxes/actions";
import {
  checkLiteraturePoolAction,
  runLiteraturePipelineAction,
  appendArchiveEntriesAction,
  finalizeOnboardingAction,
  setLiteratureCancelledAction,
} from "../literature-review/actions";
import type { SubBoxInput } from "../literature-review/_services/literature-review-papers";
import {
  runPositioningSearchAction,
  runPositioningJuryAction,
  persistPositioningReportAction,
} from "../positioning/actions";
import { createFlowId } from "@/lib/logger";

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
        "Çalışma Matrisi Kaydediliyor & Konumlandırma Raporu Hazırlanıyor",
        "Tez matrisiniz kaydediliyor, akademik veri tabanlarında tezler taranıyor ve jüri analizi ile konumlandırma raporu oluşturuluyor.",
        steps,
      );

      try {
        const clearResult = await clearDownstreamDbAction("matrix");
        if ("error" in clearResult) {
          hideLoading();
          toast.error(clearResult.error);
          return { success: false, error: clearResult.error };
        }

        const saveResult = await saveThesisMatrixAction(matrixInput);
        if ("error" in saveResult) {
          hideLoading();
          toast.error(saveResult.error);
          return { success: false, error: saveResult.error };
        }

        await completeStep(0, steps);

        const flowId = createFlowId();
        const searchResult = await runPositioningSearchAction(
          matrixInput,
          flowId,
        );
        if ("error" in searchResult) {
          hideLoading();
          toast.error(searchResult.error);
          return { success: false, error: searchResult.error };
        }

        await completeStep(1, steps);

        const juryResult = await runPositioningJuryAction(
          matrixInput,
          searchResult.theses,
          flowId,
        );
        if ("error" in juryResult) {
          hideLoading();
          toast.error(juryResult.error);
          return { success: false, error: juryResult.error };
        }

        await completeStep(2, steps);

        const persistResult = await persistPositioningReportAction(
          matrixInput,
          juryResult.juryResult,
          flowId,
        );
        if ("error" in persistResult) {
          hideLoading();
          toast.error(persistResult.error);
          return { success: false, error: persistResult.error };
        }

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
   * Runs the literature review pipeline with a 3-phase loading overlay.
   *
   * Phase 0 (Step 0 — "Mevcut literatür havuzu kontrol ediliyor..."):
   *   Quick DB check. If a pool already exists, phases 1 & 2 are skipped.
   *
   * Phase 1 (Step 1 — "Akademik kaynaklar taranıyor..."):
   *   OpenAlex search, foundational selection, related-article assignment,
   *   sanitization, and progressive DB saves.
   *
   * Phase 2 (Step 2 — "Literatür havuzu kaydediliyor..."):
   *   Final persistence (persist happens inside the pipeline action, so this
   *   step is marked complete immediately after the action returns).
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
        "Yapay zeka asistanınız her konu kutusu için akademik kaynakları araştırıyor ve literatür havuzunuzu oluşturuyor.",
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
        // ── Phase 0: DB pool check ──────────────────────────────────────
        const checkResult = await checkLiteraturePoolAction();
        if (isCancelled) return { error: "cancelled" };
        if (checkResult.error) {
          hideLoading();
          return { error: checkResult.error };
        }

        if (checkResult.exists) {
          // Pool exists — skip search and persist steps
          await completeStep(0, steps);
          await completeStep(1, steps);
          await completeStep(2, steps);
          hideLoading();
          return { data: checkResult.data! };
        }

        await completeStep(0, steps);

        // ── Phase 1: Full search pipeline ───────────────────────────────
        const pipelineResult = await runLiteraturePipelineAction(subBoxInputs);
        if (isCancelled) return { error: "cancelled" };
        if (pipelineResult.error) {
          hideLoading();
          return { error: pipelineResult.error };
        }

        await completeStep(1, steps);

        // ── Phase 2: Persist (completed inside pipeline action) ─────────
        await completeStep(2, steps);
        hideLoading();

        return { data: pipelineResult.data! };
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
    [router, showLoading, hideLoading, completeStep, queryClient],
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
          description: sb.description,
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
   * Confirms the positioning report, generates and persists the thesis box
   * structure via global loader, then navigates to the boxes page.
   */
  const proceedFromPositioning = useCallback(async () => {
    const steps = BOX_GENERATION_STEPS.map((s) => ({ ...s }));
    steps[0].status = "active";

    showLoading(
      "Altyapısal Konu Kutuları Oluşturuluyor",
      "Tez matrisiniz çözümlenerek altyapısal konu kutuları oluşturuluyor ve her kutu için literatür tarama sorguları üretiliyor.",
      steps,
    );

    try {
      // Step 1: Generate Turkish Box Structure + OpenAlex Semantic Queries (single phase)
      const genResult = await generateAndMapBoxesAction();
      if ("error" in genResult) {
        hideLoading();
        toast.error(genResult.error);
        return;
      }
      await completeStep(0, steps);

      // Step 2: Persist Boxes to DB
      const persistResult = await persistBoxesAction(genResult.boxes);
      if ("error" in persistResult) {
        hideLoading();
        toast.error(persistResult.error);
        return;
      }
      await completeStep(1, steps);

      const boxesTqKeys = getStepTanStackKeys("boxes");
      for (const key of boxesTqKeys)
        queryClient.invalidateQueries({ queryKey: key });

      hideLoading();
      router.push("/onboarding/boxes");
    } catch (err) {
      hideLoading();
      const message =
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
      toast.error(message);
    }
  }, [router, queryClient, showLoading, hideLoading, completeStep]);

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
    proceedFromBoxes,
    runLiteraturePipeline,
    proceedFromPositioning,
    finalizeLiterature,
  };
}
