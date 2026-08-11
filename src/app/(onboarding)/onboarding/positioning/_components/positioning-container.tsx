"use client";

import type { Positioning } from "@/db/schema";
import type { PositioningGlobalStatus } from "@/features/positioning/validation";
import type { JuryAnalysisResult } from "@/features/positioning/analysis";
import { usePositioningContinue } from "../../_hooks/use-positioning-continue";
import { PositioningReportView } from "./positioning-report-view";

interface PositioningContainerProps {
  initialRecord?: Positioning | null;
}

/**
 * Minimal wrapper that renders the positioning gap analysis report, which is always
 * pre-generated server-side with no pipeline running client-side.
 *
 * @param root0 - The component props.
 * @param root0.initialRecord - Optional pre-generated positioning record.
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
