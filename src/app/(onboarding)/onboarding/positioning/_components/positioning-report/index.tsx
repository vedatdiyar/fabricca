"use client";

import type { JuryAnalysisResult } from "../../_services/analysis";
import { ReportStatusBanner } from "./report-status-banner";
import { ReportOverlapSection } from "./report-overlap-section";
import { ReportClarifications } from "./report-clarifications";
import { ReportGapAnalysis } from "./report-gap-analysis";
import { ReportBottomBar } from "./report-bottom-bar";
import { usePositioningConfirm } from "./use-positioning-confirm";

interface PositioningReportViewProps {
  reportData: JuryAnalysisResult;
  onConfirm: () => void;
}

/**
 * Orchestrates full positioning report view with status, overlap, clarifications and gap analysis.
 *
 * @param props - Report view props.
 * @returns Positioning report markup.
 */
export function PositioningReportView({
  reportData,
  onConfirm,
}: PositioningReportViewProps) {
  const isDirectOverlap = reportData.globalStatus === "DIRECT_OVERLAP";
  const isNovelGap = reportData.globalStatus === "NOVEL_GAP_IDENTIFIED";
  const gapSummary = reportData.gapAnalysisSummary;

  const { questions, answers, confirming, handleAnswerChange, handleConfirm } =
    usePositioningConfirm(reportData, onConfirm);

  return (
    <div className="w-full space-y-6">
      <ReportStatusBanner globalStatus={reportData.globalStatus} />

      {isDirectOverlap && <ReportOverlapSection gapSummary={gapSummary} />}

      {isNovelGap && (
        <ReportClarifications
          questions={questions}
          answers={answers}
          onAnswerChange={handleAnswerChange}
        />
      )}

      {!isDirectOverlap && (
        <ReportGapAnalysis gapAnalysisSummary={gapSummary} />
      )}

      <ReportBottomBar
        isDirectOverlap={isDirectOverlap}
        confirming={confirming}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
