import { revalidatePath, updateTag } from "next/cache";
import { CACHE_TAGS, STEP_CACHE_DEPENDENCIES } from "./onboarding-cache";
import type { OnboardingStep } from "./onboarding-cache";

// Re-export is intentional: `onboarding-cache.ts` is client-safe (no `next/cache` import)
// and consumed directly by client components. `cache-tags.ts` is server-only (uses
// `updateTag`/`revalidatePath`) and is imported by server actions. This split keeps
// client bundles free of server-only dependencies while maintaining a single source
// of truth for CACHE_TAGS / TQ_KEYS / STEP_CACHE_DEPENDENCIES.
export { CACHE_TAGS, TQ_KEYS } from "./onboarding-cache";
export type { OnboardingStep } from "./onboarding-cache";

/**
 * Revalidates all onboarding layout routes.
 */
export function revalidateOnboardingPaths(): void {
  try {
    revalidatePath("/onboarding", "layout");
  } catch {
    // Graceful fallback outside Next.js request context
  }
}

/** Invalidates all onboarding cache tags so the next cached read fetches fresh data (full reset or onboarding finalisation). */
export function invalidateOnboardingCache(): void {
  try {
    updateTag(CACHE_TAGS.thesisMatrix);
    updateTag(CACHE_TAGS.positioning);
    updateTag(CACHE_TAGS.thesisBoxes);
    updateTag(CACHE_TAGS.thesisOutline);
  } catch {
    // Graceful fallback outside Next.js request context
  }
}

/**
 * Invalidates cache tags for the given step and all downstream steps (e.g. on step re-submission).
 *
 * @param fromStep - The step whose cache and downstream caches to invalidate.
 */
export function invalidateOnboardingStepCache(fromStep: OnboardingStep): void {
  try {
    const deps = STEP_CACHE_DEPENDENCIES[fromStep];
    for (const tag of deps.nextJsTags) {
      updateTag(tag);
    }
  } catch {
    // Graceful fallback outside Next.js request context
  }
  revalidateOnboardingPaths();
}
