import { redirect } from "next/navigation";
import { getProfile } from "@/session";
import { BoxesContainer } from "./_components/boxes-container";
import { StartOverButton } from "../_components/start-over-button";

/**
 * Onboarding sürecinin dördüncü adımı: Konu Kutuları (Server Component).
 * Kullanıcının oturum yetkisini denetler ve Zustand store'daki kutuları gösterir.
 */
export default async function OnboardingBoxesPage() {
  const profile = await getProfile();

  if (profile.onboarding_completed) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 pt-10 pb-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center space-y-4">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
          <div className="flex flex-col space-y-1 text-left">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Konu Kutuları
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tez matrisinizin çözümlenmesiyle oluşturulan konu kutularını
              inceleyin ve onaylayın.
            </p>
          </div>
          <div className="flex items-center self-end sm:self-center">
            <StartOverButton />
          </div>
        </div>

        <BoxesContainer />
      </div>
    </div>
  );
}
