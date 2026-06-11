import type { OriginalityReportData } from "@/lib/types";
import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";
import { getStoredOriginalityReportAction } from "./actions";
import { OriginalityReportView } from "./_components/originality-report-view";
import { AnalysisTrigger } from "./_components/analysis-trigger";

/**
 * Onboarding sürecinin 3. adımı: Risk Analizi Sayfası (Server Component).
 * Adım durumuna göre analizi tetikler (böylece loading.tsx stream edilir)
 * ya da önceden kaydedilmiş raporu yükleyip render eder.
 */
export default async function OnboardingRiskPage() {
  const profile = await getProfile();

  if (
    profile.onboarding_step !== "originality_report" &&
    profile.onboarding_step !== "originality_report_completed"
  ) {
    redirect("/onboarding");
  }

  // Eğer analiz henüz yapılmadıysa, sayfa render aşamasında sunucu tarafında çalıştırılması yerine
  // istemci tarafında tetiklenecek şekilde AnalysisTrigger bileşeni döndürülür.
  if (profile.onboarding_step === "originality_report") {
    return <AnalysisTrigger />;
  }

  const reportRes = await getStoredOriginalityReportAction();
  if (!reportRes.success || !reportRes.data) {
    throw new Error("Özgünlük raporu yüklenemedi. Lütfen tekrar deneyin.");
  }

  const reportData = reportRes.data as OriginalityReportData;

  return (
    <main className="min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8">
      <OriginalityReportView reportData={reportData} />
    </main>
  );
}
