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
 * Handles the outline-step confirmation: clears downstream data, generates and
 * persists the thesis boxes, then navigates to the boxes page.
 *
 * @returns The proceed-from-outline handler.
 */
export function useOutlineContinue() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();
  const { completeStep, activateStep } = useLoadingOverlaySteps();

  /**
   * Confirms the outline and generates the thesis box structure
   * with a loading overlay, then navigates to the boxes display page.
   *
   * @returns A success flag with an optional error message.
   */
  const proceedFromOutline = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const steps = BOX_GENERATION_STEPS.map((s) => ({ ...s }));
    activateStep(0, steps);

    showLoading(
      "Altyapısal Konu Kutuları Oluşturuluyor",
      "Tez matrisiniz çözümlenerek altyapısal konu kutuları oluşturuluyor ve her kutu için literatür tarama sorguları üretiliyor.",
      steps,
    );

    try {
      const flowId = createFlowId();

      const clearResult = await clearDownstreamDbAction("outline");
      if ("error" in clearResult) {
        hideLoading();
        toast.error(clearResult.error);
        return { success: false, error: clearResult.error };
      }

      const outlineTqKeys = getStepTanStackKeys("outline");
      for (const key of outlineTqKeys)
        queryClient.invalidateQueries({ queryKey: key });

      const genResult = await generateAndMapBoxesAction(flowId);
      if ("error" in genResult) {
        hideLoading();
        toast.error(genResult.error);
        return { success: false, error: genResult.error };
      }
      await completeStep(
        stageIndexOf(BOX_GENERATION_PIPELINE, "generate"),
        steps,
      );

      const persistResult = await persistBoxesAction(genResult.boxes, flowId);
      if ("error" in persistResult) {
        hideLoading();
        toast.error(persistResult.error);
        return { success: false, error: persistResult.error };
      }
      await completeStep(
        stageIndexOf(BOX_GENERATION_PIPELINE, "persist"),
        steps,
      );

      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });

      hideLoading();
      router.push("/onboarding/boxes");

      return { success: true };
    } catch (err) {
      hideLoading();
      const message =
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
      toast.error(message);
      return { success: false, error: message };
    }
  }, [
    router,
    queryClient,
    showLoading,
    hideLoading,
    completeStep,
    activateStep,
  ]);

  return { proceedFromOutline };
}
