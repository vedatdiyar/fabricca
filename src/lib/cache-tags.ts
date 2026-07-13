import { revalidatePath, updateTag } from "next/cache";
import { CACHE_TAGS, STEP_CACHE_DEPENDENCIES } from "./onboarding-cache";
import type { OnboardingStep } from "./onboarding-cache";

export { CACHE_TAGS, TQ_KEYS } from "./onboarding-cache";
export type { OnboardingStep } from "./onboarding-cache";

/** Revalidates paths that display onboarding data. */
export function revalidateOnboardingPaths(): void {
  revalidatePath("/onboarding", "layout");
}

/**
 * Invalidates every onboarding cache tag so the next cached read fetches
 * fresh data from the database.  Call without arguments for a full reset
 * (e.g. "Baştan Başla" or onboarding finalisation).
 */
export function invalidateOnboardingCache(): void {
  updateTag(CACHE_TAGS.thesisMatrix);
  updateTag(CACHE_TAGS.originalityReport);
  updateTag(CACHE_TAGS.thesisBoxes);
}

/**
 * Invalidates only the Next.js cache tags that belong to the given step
 * and all of its downstream steps.  Use this when a step is re-submitted
 * so that sibling / ancestor caches are preserved.
 *
 * @param fromStep - The step being re-submitted
 */
export function invalidateOnboardingStepCache(fromStep: OnboardingStep): void {
  const deps = STEP_CACHE_DEPENDENCIES[fromStep];
  for (const tag of deps.nextJsTags) {
    updateTag(tag);
  }
  revalidateOnboardingPaths();
}
