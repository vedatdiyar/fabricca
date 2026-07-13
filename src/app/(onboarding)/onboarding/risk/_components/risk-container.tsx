"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorDisplay } from "@/components/error-display";
import { OriginalityReportView } from "./originality-report-view";
import { useRiskAnalysis } from "../_hooks/use-risk-analysis";

/**
 * Top-level risk-stage container. Delegates all orchestration
 * (initial fetch, 4-stage analysis pipeline, proceed-to-boxes flow) to the
 * {@link useRiskAnalysis} hook and only renders the current state.
 */
export function RiskContainer() {
  const {
    loading,
    proceeding,
    error,
    reportData,
    startAnalysis,
    handleProceed,
  } = useRiskAnalysis();

  const hasNoTheses = !loading && !reportData && !error;

  if (loading) {
    return <LoadingSpinner variant="full" />;
  }

  if (reportData) {
    return (
      <div className="w-full">
        <OriginalityReportView reportData={reportData} />
        <div className="flex justify-end mt-8 pb-8">
          <Button onClick={handleProceed} disabled={proceeding} size="lg">
            {proceeding ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Kaydediliyor...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Risk Analizini Onayla ve Konu Kutularına Geç
              </span>
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full pt-10">
        <ErrorDisplay error={error} onRetry={() => startAnalysis()} />
      </div>
    );
  }

  // Idle / empty state: the auto-trigger useEffect inside useRiskAnalysis
  // handles starting the pipeline on mount. If analysis completed with no
  // matching theses, show a dedicated empty-state message.
  if (hasNoTheses) {
    return (
      <div className="p-8 text-center text-muted-foreground leading-relaxed text-sm bg-muted/10 rounded-md border border-border/40 font-sans">
        Doğrudan ilişki kuran veya karşılaştırılabilir herhangi bir akademik
        çalışma tespit edilmemiştir.
      </div>
    );
  }

  // Analysis is starting or in progress — show a loading placeholder.
  return <LoadingSpinner variant="full" message="Analiz başlatılıyor..." />;
}
