import { revalidatePath, updateTag } from "next/cache";
import { CACHE_TAGS, STEP_CACHE_DEPENDENCIES } from "./onboarding-cache";
import type { OnboardingStep } from "./onboarding-cache";

export { CACHE_TAGS, TQ_KEYS } from "./onboarding-cache";
export type { OnboardingStep } from "./onboarding-cache";

/**
 * Revalidates all onboarding layout routes.
 */
export function revalidateOnboardingPaths(): void {
  revalidatePath("/onboarding", "layout");
}

/** Invalidates all onboarding cache tags so the next cached read fetches fresh data (full reset or onboarding finalisation). */
export function invalidateOnboardingCache(): void {
  updateTag(CACHE_TAGS.thesisMatrix);
  updateTag(CACHE_TAGS.positioning);
  updateTag(CACHE_TAGS.thesisBoxes);
}

/**
 * Invalidates cache tags for the given step and all downstream steps (e.g. on step re-submission).
 *
 * @param fromStep - The step whose cache and downstream caches to invalidate.
 */
export function invalidateOnboardingStepCache(fromStep: OnboardingStep): void {
  const deps = STEP_CACHE_DEPENDENCIES[fromStep];
  for (const tag of deps.nextJsTags) {
    updateTag(tag);
  }
  revalidateOnboardingPaths();
}
