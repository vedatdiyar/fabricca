import { OnboardingStepSkeleton } from "../_components/onboarding-step-skeleton";
import { LiteratureReviewSkeleton } from "./_components/literature-review-skeleton";

/**
 * Skeleton loading UI for the onboarding literature review step.
 *
 * @returns The onboarding literature review step page skeleton.
 */
export default function LiteratureReviewLoading() {
  return (
    <OnboardingStepSkeleton>
      <LiteratureReviewSkeleton />
    </OnboardingStepSkeleton>
  );
}
