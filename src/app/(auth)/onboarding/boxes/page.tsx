import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";
import { BoxesContainer } from "./_components/boxes-container";

/**
 * Onboarding sürecinin final adımı: Bitiş ve Konu Kutuları Onayı (Server Component).
 * Kullanıcının oturum yetkisini denetler ve Zustand store'daki kutuları gösterir.
 */
export default async function OnboardingBoxesPage() {
  const profile = await getProfile();

  if (profile.onboarding_completed) {
    redirect("/dashboard");
  }

  return (
    <div className="pt-10 pb-12 px-4 sm:px-6 lg:px-8">
      <BoxesContainer />
    </div>
  );
}
