import { redirect } from "next/navigation";
import { getProfile } from "@/proxy";
import {
  startOriginalityAnalysisAction,
  getStoredOriginalityReportAction,
} from "./actions";
import { OriginalityReportView } from "./_components/originality-report-view";

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

  // Eğer analiz henüz yapılmadıysa, sayfa render aşamasında sunucu tarafında çalıştırılır.
  if (profile.onboarding_step === "originality_report") {
    console.log("[OnboardingRiskPage] Analiz sunucuda başlatılıyor...");
    const res = await startOriginalityAnalysisAction();
    if (res.error) {
      throw new Error(res.error);
    }
  }

  const reportRes = await getStoredOriginalityReportAction();
  if (!reportRes.success || !reportRes.data) {
    throw new Error("Özgünlük raporu yüklenemedi. Lütfen tekrar deneyin.");
  }

  const reportData = reportRes.data as {
    tavilyResults: {
      items: {
        fact: string;
        result: string;
        sourceUrl: string;
      }[];
      briefingNote: string;
    };
    tezaraResults: {
      originalityBadge:
        | "YÜKSEK RİSK"
        | "ORTA RİSK"
        | "DÜŞÜK RİSK"
        | "SIFIR RİSK";
      overlapTable: {
        id: number;
        title: string;
        author: string;
        university: string;
        year: number;
        thesisType: string;
        department: string;
        axes: {
          subject: "ÇAKIŞIYOR" | "KISMEN" | "ÖZGÜN";
          theory: "ÇAKIŞIYOR" | "KISMEN" | "ÖZGÜN";
          methodology: "ÇAKIŞIYOR" | "KISMEN" | "ÖZGÜN";
          context: "ÇAKIŞIYOR" | "KISMEN" | "ÖZGÜN";
        };
        originalityLevel: "YÜKSEK RİSK" | "ORTA RİSK" | "DÜŞÜK RİSK";
      }[];
      strategicRecommendations: string;
    };
  };

  return (
    <main className="min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8">
      <OriginalityReportView reportData={reportData} />
    </main>
  );
}
