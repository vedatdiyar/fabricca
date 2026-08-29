/**
 * Client-safe onboarding cache primitives with no Next.js server-only imports, imported
 * by server actions via `@/lib/cache-tags` (which re-exports) and directly by client components.
 */

export const CACHE_TAGS = {
  thesisMatrix: "thesis-matrix",
  positioning: "thesis-positioning",
  thesisBoxes: "thesis-boxes",
  thesisOutline: "thesis-outline",
} as const;

/**
 * TanStack Query key constants used across the onboarding flow that server actions
 * return to let the client invalidate its query cache.
 */
export const TQ_KEYS = {
  onboardingSteps: ["onboarding-steps"] as const,
  positioning: ["thesis-positioning"] as const,
  boxes: ["boxes"] as const,
  outline: ["thesis-outline"] as const,
  reanalyze: ["reanalyze"] as const,
} as const;

export type OnboardingStep =
  | "proposal"
  | "matrix"
  | "positioning"
  | "boxes"
  | "outline";

/**
 * Maps each onboarding step to the cache entries that become stale when that step is
 * re-submitted, with hierarchical dependencies where a step invalidates its own data
 * plus everything downstream.
 */
export const STEP_CACHE_DEPENDENCIES: Record<
  OnboardingStep,
  {
    nextJsTags: readonly string[];
    tanStackKeys: readonly (readonly string[])[];
  }
> = {
  proposal: {
    nextJsTags: [
      CACHE_TAGS.thesisMatrix,
      CACHE_TAGS.positioning,
      CACHE_TAGS.thesisBoxes,
      CACHE_TAGS.thesisOutline,
    ] as const,
    tanStackKeys: [
      TQ_KEYS.positioning,
      TQ_KEYS.boxes,
      TQ_KEYS.outline,
      TQ_KEYS.onboardingSteps,
      TQ_KEYS.reanalyze,
    ] as const,
  },
  matrix: {
    nextJsTags: [
      CACHE_TAGS.positioning,
      CACHE_TAGS.thesisBoxes,
      CACHE_TAGS.thesisOutline,
    ] as const,
    tanStackKeys: [
      TQ_KEYS.positioning,
      TQ_KEYS.boxes,
      TQ_KEYS.outline,
      TQ_KEYS.onboardingSteps,
      TQ_KEYS.reanalyze,
    ] as const,
  },
  positioning: {
    nextJsTags: [
      CACHE_TAGS.positioning,
      CACHE_TAGS.thesisBoxes,
      CACHE_TAGS.thesisOutline,
    ] as const,
    tanStackKeys: [
      TQ_KEYS.positioning,
      TQ_KEYS.boxes,
      TQ_KEYS.outline,
      TQ_KEYS.onboardingSteps,
    ] as const,
  },
  boxes: {
    nextJsTags: [CACHE_TAGS.thesisBoxes, CACHE_TAGS.thesisOutline] as const,
    tanStackKeys: [
      TQ_KEYS.boxes,
      TQ_KEYS.outline,
      TQ_KEYS.onboardingSteps,
    ] as const,
  },
  outline: {
    nextJsTags: [CACHE_TAGS.thesisOutline] as const,
    tanStackKeys: [TQ_KEYS.outline, TQ_KEYS.onboardingSteps] as const,
  },
};

/**
 * Returns the TanStack Query key arrays that should be invalidated on the client when
 * the given step is re-submitted, which server actions call and return so the client
 * can run `queryClient.invalidateQueries`.
 *
 * @param fromStep - The step being re-submitted
 * @returns Deep-cloned key arrays safe for direct use with TanStack Query
 */
export function getStepTanStackKeys(fromStep: OnboardingStep): string[][] {
  return STEP_CACHE_DEPENDENCIES[fromStep].tanStackKeys.map((key) => [...key]);
}
