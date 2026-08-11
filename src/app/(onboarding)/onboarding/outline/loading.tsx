import { OnboardingStepSkeleton } from "../_components/onboarding-step-skeleton";
import { OutlineSkeleton } from "./_components/outline-skeleton";

/**
 * Skeleton loading UI for the onboarding outline step.
 *
 * @returns The onboarding outline step page skeleton.
 */
export default function OutlineLoading() {
  return (
    <OnboardingStepSkeleton>
      <OutlineSkeleton />
    </OnboardingStepSkeleton>
  );
}
