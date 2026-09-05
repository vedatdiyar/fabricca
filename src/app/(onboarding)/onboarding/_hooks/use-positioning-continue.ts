"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLoadingOverlay } from "@/core/providers/loading-overlay-provider";
import { OUTLINE_GENERATION_STEPS } from "@/app/(onboarding)/onboarding/_services/loading-steps";
import {
  OUTLINE_GENERATION_PIPELINE,
  stageIndexOf,
} from "@/lib/pipeline-definitions";
import { createFlowId } from "@/lib/logger";
import { getStepTanStackKeys } from "@/lib/onboarding-cache";
import { clearDownstreamDbAction } from "../actions";
import {
  generateOutlineAction,
  persistOutlineAction,
} from "../outline/_services/generator";
import { useLoadingOverlaySteps } from "./use-loading-overlay-steps";

/**
 * Handles the positioning-report confirmation: generates and persists the thesis
 * outline, then navigates to the outline page.
 *
 * @returns The proceed-from-positioning handler.
 */
export function usePositioningContinue() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();
  const { completeStep, activateStep } = useLoadingOverlaySteps();

  /**
   * Confirms the positioning report and generates the thesis outline via a global loader.
   */
  const proceedFromPositioning = useCallback(async () => {
    const steps = OUTLINE_GENERATION_STEPS.map((s) => ({ ...s }));
    activateStep(0, steps);

    showLoading(
      "Tez Planı Oluşturuluyor",
      "Tez matrisiniz analiz edilerek bilim dalınız tespit ediliyor ve bölüm/alt bölüm yapısı oluşturuluyor.",
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

      const genResult = await generateOutlineAction(flowId);
      if ("error" in genResult) {
        hideLoading();
        toast.error(genResult.error);
        return;
      }
      await completeStep(
        stageIndexOf(OUTLINE_GENERATION_PIPELINE, "generate"),
        steps,
      );

      const persistResult = await persistOutlineAction(
        genResult.outline,
        flowId,
      );
      if ("error" in persistResult) {
        hideLoading();
        toast.error(persistResult.error);
        return;
      }
      await completeStep(
        stageIndexOf(OUTLINE_GENERATION_PIPELINE, "persist"),
        steps,
      );

      const outlineTqKeys = getStepTanStackKeys("outline");
      for (const key of outlineTqKeys)
        queryClient.invalidateQueries({ queryKey: key });

      hideLoading();
      router.push("/onboarding/outline");
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
