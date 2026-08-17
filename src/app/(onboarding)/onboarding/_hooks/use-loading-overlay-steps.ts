"use client";

import { useCallback, useRef } from "react";
import { useLoadingOverlay } from "@/core/providers/loading-overlay-provider";
import {
  STEP_MIN_DURATION_MS,
  isNavigationStepText,
  type LoadingStep,
} from "@/app/(onboarding)/onboarding/_services/loading-steps";

/**
 * Shared loading-overlay step helpers used across the onboarding flow hooks.
 *
 * Encapsulates the per-step minimum-duration tracking, the navigation-step
 * completion cascade, and the shared activation-time ref.
 *
 * @returns The step completion/activation helpers and their tracking ref.
 */
export function useLoadingOverlaySteps() {
  const { updateLoadingStep } = useLoadingOverlay();

  const stepActiveSinceRef = useRef<Map<number, number>>(new Map());

  /**
   * Marks a loading step as completed, respecting the minimum step duration and
   * cascading through consecutive navigation steps.
   *
   * @param index - The index of the step to complete.
   * @param steps - The full step list of the active overlay.
   */
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
   * Records a step as the active step and stamps its activation time.
   *
   * @param index - The index of the step to activate.
   * @param steps - The full step list of the active overlay.
   */
  const activateStep = useCallback((index: number, steps: LoadingStep[]) => {
    steps[index].status = "active";
    stepActiveSinceRef.current.set(index, Date.now());
  }, []);

  return { completeStep, activateStep, stepActiveSinceRef };
}
