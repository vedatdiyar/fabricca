"use client";

import { useOnboardingStore } from "@/store/useOnboardingStore";
import { AnalysisTrigger } from "./analysis-trigger";
import { OriginalityReportView } from "./originality-report-view";

/**
 * Client-side container for the Risk stage of onboarding.
 * Decides whether to render the AnalysisTrigger or the completed OriginalityReportView
 * based on the presence of the juryReport in the Zustand global store.
 */
export function RiskContainer() {
  const juryReport = useOnboardingStore((state) => state.juryReport);

  if (!juryReport) {
    return <AnalysisTrigger />;
  }

  return <OriginalityReportView reportData={juryReport} />;
}
