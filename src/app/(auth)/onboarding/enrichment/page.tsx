import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";
import { db } from "@/db";
import { thesisMatrices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { EnrichmentView } from "./_components/enrichment-view";

/**
 * Onboarding sürecinin 2. adımı: Akademik Zenginleştirme İnceleme Ekranı (Server Component).
 * Kullanıcıyı yetkilendirme durumuna göre korur, zenginleştirilmiş verileri okur ve render eder.
 */
export default async function OnboardingEnrichmentPage() {
  const profile = await getProfile();

  if (profile.onboarding_step !== "thesis_matrix_enhanced") {
    redirect("/onboarding");
  }

  const [matrix] = await db
    .select()
    .from(thesisMatrices)
    .where(eq(thesisMatrices.userId, profile.id));

  if (!matrix) {
    redirect("/onboarding/matrix");
  }

  const initialData = {
    akademikCalismaBasligi: matrix.calismaBasligi,
    literaturluArastirmaSorusu: matrix.arastirmaSorusu,
    olgunlastirilmisTezSavi: matrix.temelIddia,
    kavramsalVeKuramsalAltyapi: matrix.kuramsalCerceve,
    akademikMetodolojiTasarimi: matrix.metodoloji,
    tarihselMekansalSinirlar: matrix.tarihselMekansalSinirlar,
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center space-y-8">
        <div className="flex flex-col items-center space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Akademik Zenginleştirme
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ham tez fikirleriniz akademik dile tercüme edildi. Düzenleyip
            onaylayabilirsiniz.
          </p>
        </div>

        <EnrichmentView initialData={initialData} />
      </div>
    </main>
  );
}
