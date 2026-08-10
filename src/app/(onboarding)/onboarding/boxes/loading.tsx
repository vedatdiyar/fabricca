import { OnboardingStepSkeleton } from "../_components/onboarding-step-skeleton";
import { BoxesSkeleton } from "./_components/boxes-skeleton";

/**
 * Skeleton loading UI for the onboarding boxes step.
 *
 * @returns The onboarding boxes step page skeleton.
 */
export default function BoxesLoading() {
  return (
    <OnboardingStepSkeleton>
      <BoxesSkeleton />
    </OnboardingStepSkeleton>
  );
}
