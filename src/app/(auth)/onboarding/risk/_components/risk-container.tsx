"use client";

import { Loader2 } from "lucide-react";
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

  // Idle state: the auto-trigger useEffect inside useRiskAnalysis handles
  // starting the pipeline on mount. Render a static loading placeholder.
  return <LoadingSpinner variant="full" message="Analiz başlatılıyor..." />;
}
