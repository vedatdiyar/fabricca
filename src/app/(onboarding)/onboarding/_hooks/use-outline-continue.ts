"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLoadingOverlay } from "@/providers/loading-overlay-provider";
import { getStepTanStackKeys } from "@/lib/onboarding-cache";
import { clearDownstreamDbAction } from "../actions";
import { fetchUncachedBoxesWithFullShape } from "../_services/fetch-actions";
import type { SubBoxInput } from "@/features/literature-review/literature-review-papers";
import { useLiteratureContinue } from "./use-literature-continue";

/**
 * Handles the outline-step confirmation: clears downstream data, runs the
 * literature pipeline, then navigates to the literature review page.
 *
 * @returns The proceed-from-outline handler.
 */
export function useOutlineContinue() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hideLoading } = useLoadingOverlay();
  const { runLiteraturePipeline } = useLiteratureContinue();

  /**
   * Confirms the outline and runs the literature review pipeline,
   * then navigates to the literature review page.
   *
   * @returns A success flag with an optional error message.
   */
  const proceedFromOutline = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      const clearResult = await clearDownstreamDbAction("outline");
      if ("error" in clearResult) {
        toast.error(clearResult.error);
        return { success: false, error: clearResult.error };
      }

      const outlineTqKeys = getStepTanStackKeys("outline");
      for (const key of outlineTqKeys)
        queryClient.invalidateQueries({ queryKey: key });

      const boxes = await fetchUncachedBoxesWithFullShape();
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
        })),
      }));

      const litResult = await runLiteraturePipeline(subBoxInputs);
      if (litResult.error) {
        return { success: false, error: litResult.error };
      }

      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });
      if (litResult.data) {
        queryClient.setQueryData(["literature-pool"], litResult.data);
      }

      hideLoading();
      router.push("/onboarding/literature-review");

      return { success: true };
    } catch (err) {
      hideLoading();
      const message =
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
      toast.error(message);
      return { success: false, error: message };
    }
  }, [queryClient, runLiteraturePipeline, hideLoading, router]);

  return { proceedFromOutline };
}
