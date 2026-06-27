"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorDisplay } from "@/components/error-display";
import { OriginalityReportView } from "./originality-report-view";
import { useRiskAnalysis } from "../_hooks/use-risk-analysis";

/**
 * Safety-net fallback rendered when no report exists, no error occurred, and the
 * auto-trigger inside {@link useRiskAnalysis} has not yet started the pipeline.
 * Triggers the analysis immediately on mount.
 */
function IdleFallback({ startAnalysis }: { startAnalysis: () => void }) {
  useEffect(() => {
    startAnalysis();
  }, [startAnalysis]);

  return <LoadingSpinner variant="full" message="Analiz başlatılıyor..." />;
}

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
              "Analizi Onayla ve Kutulara Geç"
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

  // Idle state: no report, no error, not loading. The auto-trigger useEffect
  // inside useRiskAnalysis should start the pipeline immediately, but as a
  // safety net we also fire startAnalysis from IdleFallback.
  return <IdleFallback startAnalysis={startAnalysis} />;
}
