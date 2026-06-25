import { revalidatePath, updateTag } from "next/cache";

export const CACHE_TAGS = {
  thesisMatrix: "thesis-matrix",
  originalityReport: "originality-report",
  thesisBoxes: "thesis-boxes",
} as const;

/** Revalidates paths that display onboarding data. */
export function revalidateOnboardingPaths(): void {
  revalidatePath("/onboarding", "layout");
  revalidatePath("/", "layout");
}

/**
 * Invalidates every onboarding cache tag so the next cached read fetches
 * fresh data from the database.
 */
export function invalidateOnboardingCache(): void {
  updateTag(CACHE_TAGS.thesisMatrix);
  updateTag(CACHE_TAGS.originalityReport);
  updateTag(CACHE_TAGS.thesisBoxes);
}
