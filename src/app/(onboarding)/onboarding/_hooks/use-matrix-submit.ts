"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLoadingOverlay } from "@/providers/loading-overlay-provider";
import { MATRIX_SUBMIT_STEPS } from "../_lib/loading-steps";
import type { ThesisMatrix } from "@/lib/types";
import { clearDownstreamDbAction } from "../actions";
import { saveThesisMatrixAction } from "../matrix/actions";
import {
  runPositioningSearchAction,
  runPositioningJuryAction,
  persistPositioningReportAction,
  logPositioningPipelineSuccessAction,
} from "../positioning/actions";
import { createFlowId } from "@/lib/logger";
import { useLoadingOverlaySteps } from "./use-loading-overlay-steps";

/**
 * Handles thesis matrix submission: saves the matrix, runs the positioning AI
 * pipeline, and navigates to the positioning report.
 *
 * @returns The matrix submit handler.
 */
export function useMatrixSubmit() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();
  const { completeStep, activateStep } = useLoadingOverlaySteps();

  /**
   * Saves the matrix and runs the positioning pipeline under a shared loading overlay.
   *
   * @param matrixInput - The thesis matrix to save and analyze.
   * @returns A success flag with an optional error message.
   */
  const submitMatrix = useCallback(
    async (
      matrixInput: ThesisMatrix,
    ): Promise<{ success: boolean; error?: string }> => {
      const steps = MATRIX_SUBMIT_STEPS.map((s) => ({ ...s }));
      activateStep(0, steps);

      showLoading(
        "Çalışma Matrisi Kaydediliyor & Konumlandırma Raporu Hazırlanıyor",
        "Tez matrisiniz kaydediliyor, akademik veri tabanlarında tezler taranıyor ve jüri analizi ile konumlandırma raporu oluşturuluyor.",
        steps,
      );

      try {
        const pipelineStart = performance.now();
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

        await logPositioningPipelineSuccessAction(
          flowId,
          performance.now() - pipelineStart,
        );

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
    [router, queryClient, showLoading, hideLoading, completeStep, activateStep],
  );

  return { submitMatrix };
}
