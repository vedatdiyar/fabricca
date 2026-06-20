import { redirect } from "next/navigation";
import { getProfile } from "@/session";
import { RiskContainer } from "./_components/risk-container";
import { StartOverButton } from "../_components/start-over-button";

/**
 * Onboarding sürecinin 3. adımı: Risk Analizi Sayfası (Server Component).
 * Oturum yetkilendirmesini denetler ve istemci tarafındaki RiskContainer bileşenini çağırır.
 * Veritabanı sorgulamalarını kaldırarak onboarding sürecindeki tüm ara analizlerin
 * Zustand store (sessionStorage) üzerinde saklanmasına olanak tanır.
 */
export default async function OnboardingRiskPage() {
  const profile = await getProfile();

  if (profile.onboarding_completed) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 pt-10 pb-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center space-y-4">
        <div className="flex w-full flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
          <div className="flex flex-col space-y-1 text-left">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Özgünlük & Risk Analizi
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tez matrisinizin literatürdeki konumunu ve özgünlük durumunu
              analiz edin.
            </p>
          </div>
          <div className="flex items-center self-end sm:self-center">
            <StartOverButton />
          </div>
        </div>

        <RiskContainer />
      </div>
    </div>
  );
}
