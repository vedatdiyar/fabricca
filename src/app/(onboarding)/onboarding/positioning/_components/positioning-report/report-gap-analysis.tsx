import { PositioningMarkdownRenderer } from "../positioning-markdown-renderer";
import type { JuryAnalysisResult } from "../../_services/analysis";

interface ReportGapAnalysisProps {
  gapAnalysisSummary: JuryAnalysisResult["gapAnalysisSummary"];
}

/**
 * Renders gap analysis markdown section.
 *
 * @param props - Gap analysis props.
 * @returns Gap analysis markup.
 */
export function ReportGapAnalysis({
  gapAnalysisSummary,
}: ReportGapAnalysisProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col space-y-1">
        <h2 className="font-serif text-base font-semibold tracking-tight text-foreground">
          Akademik Boşluk Analizi ve Çok Kanallı Literatür Sentezi
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Çalışmanızın literatürdeki konumu, tespit edilen boşluklar ve özgün
          katkısı aşağıda 3 stratejik boyutta sentezlenmiştir.
        </p>
      </div>
      <PositioningMarkdownRenderer content={gapAnalysisSummary} />
    </div>
  );
}
