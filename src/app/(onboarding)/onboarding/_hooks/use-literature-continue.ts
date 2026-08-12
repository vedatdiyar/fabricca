"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLoadingOverlay } from "@/providers/loading-overlay-provider";
import { LITERATURE_PIPELINE_STEPS } from "@/features/onboarding/loading-steps";
import type { LiteraturePoolEntry } from "@/lib/types";
import { getStepTanStackKeys } from "@/lib/onboarding-cache";
import { clearDownstreamDbAction } from "../actions";
import {
  checkLiteraturePoolAction,
  runLiteraturePipelineAction,
  finalizeOnboardingAction,
  setLiteratureCancelledAction,
} from "../literature-review/actions";
import type { SubBoxInput } from "@/features/literature-review/literature-review-papers";
import { useLoadingOverlaySteps } from "./use-loading-overlay-steps";

/**
 * Handles the literature-review flow: running the literature pipeline and finalizing onboarding.
 *
 * @returns The literature pipeline runner and finalize handler.
 */
export function useLiteratureContinue() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();
  const { completeStep, activateStep } = useLoadingOverlaySteps();

  /**
   * Runs the literature review pipeline with a 3-phase loading overlay.
   *
   * @param subBoxInputs - The sub-box inputs to scan the literature for.
   * @returns The literature pool entries or an error message.
   */
  const runLiteraturePipeline = useCallback(
    async (
      subBoxInputs: SubBoxInput[],
    ): Promise<{ data?: LiteraturePoolEntry[]; error?: string }> => {
      const steps = LITERATURE_PIPELINE_STEPS.map((s) => ({ ...s }));
      activateStep(0, steps);

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
        const checkResult = await checkLiteraturePoolAction();
        if (isCancelled) return { error: "cancelled" };
        if (checkResult.error) {
          hideLoading();
          return { error: checkResult.error };
        }

        if (checkResult.exists) {
          await completeStep(0, steps);
          await completeStep(1, steps);
          await completeStep(2, steps);
          hideLoading();
          return { data: checkResult.data! };
        }

        await completeStep(0, steps);

        const pipelineResult = await runLiteraturePipelineAction(subBoxInputs);
        if (isCancelled) return { error: "cancelled" };
        if (pipelineResult.error) {
          hideLoading();
          return { error: pipelineResult.error };
        }

        await completeStep(1, steps);

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
    [router, showLoading, hideLoading, completeStep, activateStep, queryClient],
  );

  /**
   * Finalizes onboarding, then navigates to the dashboard.
   *
   * @returns A success flag with an optional error message.
   */
  const finalizeLiterature = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      const finalizeResult = await finalizeOnboardingAction();
      if ("error" in finalizeResult && finalizeResult.error) {
        toast.error(finalizeResult.error);
        return { success: false, error: finalizeResult.error };
      }

      queryClient.invalidateQueries();
      toast.success("Tebrikler! Onboarding süreciniz tamamlandı.");
      router.push("/dashboard");

      return { success: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
      toast.error(message);
      return { success: false, error: message };
    }
  }, [queryClient, router]);

  return { runLiteraturePipeline, finalizeLiterature };
}
