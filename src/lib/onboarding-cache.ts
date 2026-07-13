/**
 * Client-safe onboarding cache primitives — no Next.js server-only imports.
 * Server actions import these via `@/lib/cache-tags` (which re-exports).
 * Client components import directly from here.
 */

export const CACHE_TAGS = {
  thesisMatrix: "thesis-matrix",
  originalityReport: "originality-report",
  thesisBoxes: "thesis-boxes",
} as const;

/**
 * TanStack Query key constants used across the onboarding flow.
 * Server actions return these to let the client invalidate its query cache.
 */
export const TQ_KEYS = {
  onboardingSteps: ["onboarding-steps"] as const,
  originalityReport: ["originalityReport"] as const,
  boxes: ["boxes"] as const,
  reanalyze: ["reanalyze"] as const,
} as const;

export type OnboardingStep = "matrix" | "risk" | "boxes";

/**
 * Maps each onboarding step to the cache entries that become stale when
 * that step is re-submitted.  Dependencies are hierarchical — a step
 * invalidates its own data plus everything downstream.
 */
export const STEP_CACHE_DEPENDENCIES: Record<
  OnboardingStep,
  {
    nextJsTags: readonly string[];
    tanStackKeys: readonly (readonly string[])[];
  }
> = {
  matrix: {
    nextJsTags: [CACHE_TAGS.originalityReport, CACHE_TAGS.thesisBoxes] as const,
    tanStackKeys: [
      TQ_KEYS.originalityReport,
      TQ_KEYS.boxes,
      TQ_KEYS.onboardingSteps,
      TQ_KEYS.reanalyze,
    ] as const,
  },
  risk: {
    nextJsTags: [CACHE_TAGS.thesisBoxes] as const,
    tanStackKeys: [TQ_KEYS.boxes, TQ_KEYS.onboardingSteps] as const,
  },
  boxes: {
    nextJsTags: [CACHE_TAGS.thesisBoxes] as const,
    tanStackKeys: [TQ_KEYS.boxes, TQ_KEYS.onboardingSteps] as const,
  },
};

/**
 * Returns the TanStack Query key arrays that should be invalidated on the
 * client when the given step is re-submitted.  Server actions call this
 * and return the keys so the client can run `queryClient.invalidateQueries`.
 *
 * @param fromStep - The step being re-submitted
 * @returns Deep-cloned key arrays safe for direct use with TanStack Query
 */
export function getStepTanStackKeys(fromStep: OnboardingStep): string[][] {
  return STEP_CACHE_DEPENDENCIES[fromStep].tanStackKeys.map((key) => [...key]);
}
