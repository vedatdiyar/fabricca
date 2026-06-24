"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (reportData) {
    return (
      <div className="w-full">
        <OriginalityReportView reportData={reportData} />
        <div className="flex justify-end mt-8 pb-8">
          <Button
            onClick={handleProceed}
            disabled={proceeding}
            className="btn-academic-hero"
          >
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

  // Idle state should never be reached in the normal onboarding flow because
  // the 4-stage analysis already runs inside EnrichmentView and its result is
  // cached in Zustand. If it does (e.g. direct URL access), the auto-trigger
  // useEffect in useRiskAnalysis will start the pipeline immediately.
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}
