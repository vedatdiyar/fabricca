"use client";

import type { Positioning } from "@/core/db/schema";
import type {
  PositioningGlobalStatus,
  GapAnalysisStructured,
} from "../_services/validation";
import type { JuryAnalysisResult } from "../_services/analysis";
import { usePositioningContinue } from "../../_hooks/use-positioning-continue";
import { PositioningReportView } from "./positioning-report-view";

interface PositioningContainerProps {
  initialRecord?: Positioning | null;
}

/**
 * Client container that wraps and passes the pre-generated positioning gap analysis report
 * to PositioningReportView.
 *
 * @param props - Component props containing optional pre-generated positioning record.
 * @returns The rendered positioning report view.
 */
export function PositioningContainer({
  initialRecord,
}: PositioningContainerProps) {
  const { proceedFromPositioning } = usePositioningContinue();

  const reportData: JuryAnalysisResult = {
    globalStatus:
      (initialRecord?.globalStatus as PositioningGlobalStatus) ??
      "NO_RELATED_LITERATURE",
    gapAnalysisSummary:
      (initialRecord?.gapAnalysisSummary as GapAnalysisStructured) ?? {
        literatureMapping: "",
        academicGap: "",
        originalContribution: "",
      },
    recommendedTheses: [],
  };

  return (
    <PositioningReportView
      reportData={reportData}
      onConfirm={proceedFromPositioning}
    />
  );
}
