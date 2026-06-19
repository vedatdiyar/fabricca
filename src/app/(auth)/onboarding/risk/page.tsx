import { redirect } from "next/navigation";
import { getProfile } from "@/session";
import { RiskContainer } from "./_components/risk-container";

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
    <div className="pt-10 pb-10 px-4 sm:px-6 lg:px-8">
      <RiskContainer />
    </div>
  );
}
