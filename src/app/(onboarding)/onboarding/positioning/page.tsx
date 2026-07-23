import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { getPositioningAction } from "./actions";
import { PositioningContainer } from "./_components/positioning-container";
import { StartOverButton } from "../_components/start-over-button";

/**
 * Server Component for the Universal Positioning Matrix onboarding page.
 * Guards unauthorized access and completed onboarding profiles, rendering
 * the 5-field positioning matrix form, loading overlay, or gap analysis report.
 */
export default async function OnboardingPositioningPage() {
  const profile = await getProfile();

  if (profile.onboardingCompleted) {
    redirect("/dashboard");
  }

  const record = await getPositioningAction();

  return (
    <div className="flex flex-col items-center justify-center p-4 pt-10 pb-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center space-y-4">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
          <div className="flex flex-col space-y-1 text-left">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
              Evrensel Tez Matrisi ve Konumlandırma
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Çalışmanızın odağını, kuramsal çerçevesini, yöntemini ve
              sınırlarını tanımlayarak literatürdeki özgün konumunuzu
              belirleyin.
            </p>
          </div>
          <div className="flex items-center self-end sm:self-center">
            <StartOverButton />
          </div>
        </div>

        <PositioningContainer initialRecord={record} />
      </div>
    </div>
  );
}
