import { Suspense } from "react";
import { OnboardingStepper } from "./_components/onboarding-stepper";
import { OnboardingStepperSkeleton } from "./_components/onboarding-stepper-skeleton";
import { OnboardingContent } from "./_components/onboarding-content";
import { checkStepsDataAction } from "@/app/(onboarding)/onboarding/_services/fetch-actions";

/**
 * Wraps all onboarding pages with the step navigation sidebar and content area.
 *
 * PPR/Instant Navigations compatibility: The layout shell renders synchronously
 * and instantly, while the dynamic stepper data is resolved inside a Suspense boundary.
 *
 * @param root0 - The layout props object.
 * @param root0.children - The active onboarding step page content.
 * @returns The onboarding layout markup with the step navigation.
 */
export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-background">
      <Suspense fallback={<OnboardingStepperSkeleton />}>
        <OnboardingStepperServer />
      </Suspense>
      <main className="min-w-0 flex-1">
        <OnboardingContent>{children}</OnboardingContent>
      </main>
    </div>
  );
}

/**
 * Server component that fetches user step completion data and renders the interactive stepper.
 *
 * @returns The OnboardingStepper client component with initialized data.
 */
async function OnboardingStepperServer() {
  const stepsData = (await checkStepsDataAction()) ?? {};
  return <OnboardingStepper initialData={stepsData} />;
}
