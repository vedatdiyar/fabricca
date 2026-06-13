import type { OriginalityReportData } from "@/lib/types";
import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";
import { getStoredOriginalityReportAction } from "./actions";
import { OriginalityReportView } from "./_components/originality-report-view";
import { AnalysisTrigger } from "./_components/analysis-trigger";
import { db } from "@/db";
import { originalityReports, users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Onboarding sürecinin 3. adımı: Risk Analizi Sayfası (Server Component).
 * Adım durumuna göre analizi tetikler (böylece loading.tsx stream edilir)
 * ya da önceden kaydedilmiş raporu yükleyip render eder.
 */
export default async function OnboardingRiskPage() {
  const profile = await getProfile();

  if (
    profile.onboarding_step !== "originality_report" &&
    profile.onboarding_step !== "originality_report_processing" &&
    profile.onboarding_step !== "originality_report_completed"
  ) {
    redirect("/onboarding");
  }

  let onboardingStep = profile.onboarding_step;

  // Otomatik İyileştirme (Auto-healing): Eğer veri tabanında rapor zaten varsa ama adım tamamlanmadıysa, adımı tamamla
  if (
    onboardingStep === "originality_report" ||
    onboardingStep === "originality_report_processing"
  ) {
    const [report] = await db
      .select()
      .from(originalityReports)
      .where(eq(originalityReports.userId, profile.id));

    if (report) {
      await db
        .update(users)
        .set({ onboardingStep: "originality_report_completed" })
        .where(eq(users.id, profile.id));
      onboardingStep = "originality_report_completed";
    }
  }

  // Eğer analiz henüz yapılmadıysa veya devam ediyorsa, sayfa render aşamasında sunucu tarafında çalıştırılması yerine
  // istemci tarafında tetiklenecek/sorgulanacak şekilde AnalysisTrigger bileşeni döndürülür.
  if (
    onboardingStep === "originality_report" ||
    onboardingStep === "originality_report_processing"
  ) {
    return <AnalysisTrigger initialStep={onboardingStep} />;
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
