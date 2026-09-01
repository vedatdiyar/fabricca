import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { getPositioningAction } from "./actions";
import { PositioningContainer } from "./_components/positioning-container";
import { OnboardingStepHeader } from "../_components/onboarding-step-header";

/**
 * Server Component for the Universal Positioning Matrix onboarding page that guards
 * unauthorized access and completed onboarding profiles, rendering the 5-field
 * positioning matrix form, loading overlay, or gap analysis report.
 *
 * @returns The positioning report page or a redirect to dashboard or matrix.
 */
export default async function OnboardingPositioningPage() {
  const profile = await getProfile();

  if (profile.onboardingCompleted) {
    redirect("/dashboard");
  }

  const record = await getPositioningAction();

  if (!record || !record.globalStatus) {
    redirect("/onboarding/proposal");
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 pt-10 pb-4">
      <div className="flex w-full max-w-5xl flex-col items-center space-y-4">
        <OnboardingStepHeader
          title="Akademik Konumlandırma Raporu"
          description="Çalışmanızın odağı, yöntemi ve kapsamı literatürdeki mevcut tezlerle karşılaştırılarak özgünlük boşluğunuz analiz edildi."
        />

        <PositioningContainer initialRecord={record} />
      </div>
    </div>
  );
}
