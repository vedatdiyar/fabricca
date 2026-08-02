import { OnboardingStepper } from "./_components/onboarding-stepper";
import { OnboardingContent } from "./_components/onboarding-content";
import { checkStepsDataAction } from "./_services/fetch-actions";

/**
 * Wraps all onboarding pages with the step navigation sidebar and content area.
 *
 * @param root0 - The layout props object.
 * @param root0.children - The active onboarding step page content.
 * @returns The onboarding layout markup with the step navigation.
 */
export default async function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const stepsData = (await checkStepsDataAction()) ?? {};

  return (
    <div className="flex min-h-screen bg-background">
      <OnboardingStepper initialData={stepsData} />
      <main className="flex-1 min-w-0">
        <OnboardingContent>{children}</OnboardingContent>
      </main>
    </div>
  );
}
