import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { MatrixOnboardingContainer } from "./_components/matrix-onboarding-container";
import { StartOverButton } from "../_components/start-over-button";
import { fetchThesisMatrixFresh } from "@/app/(onboarding)/onboarding/_services/fetch-actions";

/**
 * Onboarding step 1: Socratic academic advisor and living thesis matrix canvas.
 *
 * @returns The rendered matrix onboarding page.
 */
export default async function OnboardingMatrixPage() {
  const profile = await getProfile();

  if (profile.onboardingCompleted) {
    redirect("/dashboard");
  }

  const initialMatrix = await fetchThesisMatrixFresh();

  return (
    <div className="flex flex-col items-center justify-center p-4 pt-10 pb-4">
      <div className="flex w-full max-w-5xl flex-col items-center space-y-4">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
          <div className="flex flex-col space-y-1 text-left">
            <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Çalışma Matrisi & Tez Odası
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Kıdemli tez danışmanıyla müzakere ederek çalışmanızın 4 temel
              yapı taşını Sokratik yöntemle inşa edin.
            </p>
          </div>
          <div className="flex items-center self-end sm:self-center">
            <StartOverButton />
          </div>
        </div>

        <MatrixOnboardingContainer
          initialMatrix={initialMatrix}
        />
      </div>
    </div>
  );
}


