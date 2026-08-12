"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLoadingOverlay } from "@/providers/loading-overlay-provider";
import { OUTLINE_GENERATION_STEPS } from "@/features/onboarding/loading-steps";
import { getStepTanStackKeys } from "@/lib/onboarding-cache";
import { clearDownstreamDbAction } from "../actions";
import {
  generateOutlineAction,
  persistOutlineAction,
} from "@/features/outline/generator";
import { useLoadingOverlaySteps } from "./use-loading-overlay-steps";

/**
 * Handles the boxes-step confirmation: clears downstream data, generates and
 * persists the thesis outline, then navigates to the outline page.
 *
 * @returns The proceed-from-boxes handler.
 */
export function useBoxesContinue() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();
  const { completeStep, activateStep } = useLoadingOverlaySteps();

  /**
   * Clears downstream data for the boxes step, generates the thesis outline
   * with a loading overlay, then navigates to the outline display page.
   *
   * @returns A success flag with an optional error message.
   */
  const proceedFromBoxes = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const steps = OUTLINE_GENERATION_STEPS.map((s) => ({ ...s }));
    activateStep(0, steps);

    showLoading(
      "Tez Planı Oluşturuluyor",
      "Tez matrisiniz analiz edilerek bilim dalınız tespit ediliyor ve bölüm/alt bölüm yapısı oluşturuluyor.",
      steps,
    );

    try {
      const clearResult = await clearDownstreamDbAction("boxes");
      if ("error" in clearResult) {
        hideLoading();
        toast.error(clearResult.error);
        return { success: false, error: clearResult.error };
      }

      const boxesTqKeys = getStepTanStackKeys("boxes");
      for (const key of boxesTqKeys)
        queryClient.invalidateQueries({ queryKey: key });

      const genResult = await generateOutlineAction();
      if ("error" in genResult) {
        hideLoading();
        toast.error(genResult.error);
        return { success: false, error: genResult.error };
      }

      await completeStep(0, steps);

      const persistResult = await persistOutlineAction(genResult.outline);
      if ("error" in persistResult) {
        hideLoading();
        toast.error(persistResult.error);
        return { success: false, error: persistResult.error };
      }

      await completeStep(1, steps);

      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });

      hideLoading();
      router.push("/onboarding/outline");

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

  return { proceedFromBoxes };
}
