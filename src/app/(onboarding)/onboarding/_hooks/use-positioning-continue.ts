"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLoadingOverlay } from "@/core/providers/loading-overlay-provider";
import { BOX_GENERATION_STEPS } from "@/app/(onboarding)/onboarding/_services/loading-steps";
import {
  BOX_GENERATION_PIPELINE,
  stageIndexOf,
} from "@/lib/pipeline-definitions";
import { createFlowId } from "@/lib/logger";
import { getStepTanStackKeys } from "@/lib/onboarding-cache";
import { clearDownstreamDbAction } from "../actions";
import {
  generateAndMapBoxesAction,
  persistBoxesAction,
} from "../boxes/actions";
import { useLoadingOverlaySteps } from "./use-loading-overlay-steps";

/**
 * Handles the positioning-report confirmation: generates and persists the thesis
 * boxes, then navigates to the boxes page.
 *
 * @returns The proceed-from-positioning handler.
 */
export function usePositioningContinue() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();
  const { completeStep, activateStep } = useLoadingOverlaySteps();

  /**
   * Confirms the positioning report and generates the thesis box structure via a global loader.
   */
  const proceedFromPositioning = useCallback(async () => {
    const steps = BOX_GENERATION_STEPS.map((s) => ({ ...s }));
    activateStep(0, steps);

    showLoading(
      "Altyapısal Konu Kutuları Oluşturuluyor",
      "Tez matrisiniz çözümlenerek altyapısal konu kutuları oluşturuluyor ve her kutu için literatür tarama sorguları üretiliyor.",
      steps,
    );

    const flowId = createFlowId();

    try {
      const clearResult = await clearDownstreamDbAction("positioning");
      if ("error" in clearResult) {
        hideLoading();
        toast.error(clearResult.error);
        return;
      }

      const genResult = await generateAndMapBoxesAction(flowId);
      if ("error" in genResult) {
        hideLoading();
        toast.error(genResult.error);
        return;
      }
      await completeStep(
        stageIndexOf(BOX_GENERATION_PIPELINE, "generate"),
        steps,
      );

      const persistResult = await persistBoxesAction(genResult.boxes, flowId);
      if ("error" in persistResult) {
        hideLoading();
        toast.error(persistResult.error);
        return;
      }
      await completeStep(
        stageIndexOf(BOX_GENERATION_PIPELINE, "persist"),
        steps,
      );

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
  }, [
    router,
    queryClient,
    showLoading,
    hideLoading,
    completeStep,
    activateStep,
  ]);

  return { proceedFromPositioning };
}
