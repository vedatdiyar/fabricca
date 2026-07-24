"use client";

import type { ThesisPositioning } from "@/db/schema";
import type { PositioningGlobalStatus } from "../_lib/validation";
import type { JuryAnalysisResult } from "../_services/analysis";
import { useOnboardingNavigation } from "../../_hooks/use-onboarding-navigation";
import { PositioningReportView } from "./positioning-report-view";

interface PositioningContainerProps {
  initialRecord?: ThesisPositioning | null;
}

/**
 * Minimal wrapper that renders the positioning gap analysis report.
 * The report is always pre-generated server-side; no pipeline runs client-side.
 */
export function PositioningContainer({
  initialRecord,
}: PositioningContainerProps) {
  const { proceedFromPositioning } = useOnboardingNavigation();

  const reportData: JuryAnalysisResult = {
    globalStatus:
      (initialRecord?.globalStatus as PositioningGlobalStatus) ??
      "NO_RELATED_LITERATURE",
    gapAnalysisSummary:
      (initialRecord?.gapAnalysisSummary as JuryAnalysisResult["gapAnalysisSummary"]) ?? {
        literatureMapping: "",
        academicGap: "",
        originalContribution: "",
      },
    recommendedTheses:
      (initialRecord?.recommendedTheses as JuryAnalysisResult["recommendedTheses"]) ??
      [],
  };

  return (
    <PositioningReportView
      reportData={reportData}
      onConfirm={proceedFromPositioning}
    />
  );
}
