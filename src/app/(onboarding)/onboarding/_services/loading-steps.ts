import {
  BOX_GENERATION_PIPELINE,
  LITERATURE_PIPELINE,
  MATRIX_SUBMIT_PIPELINE,
  MATRIX_SYNTHESIS_PIPELINE,
  OUTLINE_GENERATION_PIPELINE,
  PROPOSAL_AUDIT_PIPELINE,
  toLoadingSteps,
} from "@/lib/pipeline-definitions";

export interface LoadingStep {
  text: string;
  status: "idle" | "active" | "completed";
}

export const STEP_MIN_DURATION_MS = 1200;

/**
 * Determines whether a loading step text marks a navigation step.
 *
 * @param text - The loading step text to inspect.
 * @returns True when the step is a navigation step.
 */
export function isNavigationStepText(text: string): boolean {
  return text.includes("yönlendiriliyor");
}

export const MATRIX_SUBMIT_STEPS: LoadingStep[] = toLoadingSteps(
  MATRIX_SUBMIT_PIPELINE,
);

export const PROPOSAL_AUDIT_STEPS: LoadingStep[] = toLoadingSteps(
  PROPOSAL_AUDIT_PIPELINE,
);

export const MATRIX_SYNTHESIS_STEPS: LoadingStep[] = toLoadingSteps(
  MATRIX_SYNTHESIS_PIPELINE,
);

export const BOX_GENERATION_STEPS: LoadingStep[] = toLoadingSteps(
  BOX_GENERATION_PIPELINE,
);

export const LITERATURE_PIPELINE_STEPS: LoadingStep[] =
  toLoadingSteps(LITERATURE_PIPELINE);

export const OUTLINE_GENERATION_STEPS: LoadingStep[] = toLoadingSteps(
  OUTLINE_GENERATION_PIPELINE,
);

