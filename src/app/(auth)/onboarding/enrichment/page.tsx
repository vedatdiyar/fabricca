import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";
import { EnrichmentView } from "./_components/enrichment-view";
import { StartOverButton } from "../_components/start-over-button";

/**
 * Onboarding sürecinin 2. adımı: Akademik Zenginleştirme İnceleme Ekranı (Server Component).
 * Kullanıcıyı yetkilendirme durumuna göre korur ve EnrichmentView bileşenini çağırır.
 * Veritabanı sorgulamalarını kaldırarak sürecin database-free olmasını sağlar.
 */
export default async function OnboardingEnrichmentPage() {
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
              Akademik Zenginleştirme
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ham tez fikirleriniz akademik dile tercüme edildi. Düzenleyip
              onaylayabilirsiniz.
            </p>
          </div>
          <div className="flex items-center self-end sm:self-center">
            <StartOverButton />
          </div>
        </div>

        <EnrichmentView />
      </div>
    </div>
  );
}
