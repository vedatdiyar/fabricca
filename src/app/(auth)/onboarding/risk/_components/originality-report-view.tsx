"use client";

import { useMemo } from "react";
import { Award } from "lucide-react";
import { StartOverButton } from "../../_components/start-over-button";
import { TavilyFactCheckTable } from "./tavily-fact-check-table";
import { TezaraOverlapTable } from "./tezara-overlap-table";
import { StrategicRoadmapSection } from "./strategic-roadmap-section";
import { statusTranslation, BADGE_COLORS } from "../_lib/constants";
import type { OriginalityReportData } from "@/lib/types";

interface OriginalityReportViewProps {
  reportData: OriginalityReportData;
}

/**
 * Top-level originality report view. Composes the three sub-sections
 * (Tavily fact-check table, Tezara overlap matrix, strategic roadmap) and
 * renders the overall-risk badge and risk-based actions.
 */
export function OriginalityReportView({ reportData }: OriginalityReportViewProps) {
  const { tavilyResults, tezaraResults } = reportData;

  const hasOriginalComparisonNotes = useMemo(() => {
    return tezaraResults.overlapTable?.some((item) => item.comparisonNote) || false;
  }, [tezaraResults.overlapTable]);

  const badgeColor = BADGE_COLORS[tezaraResults.originalityBadge] ?? BADGE_COLORS.ZERO_RISK;

  const riskLevel: "HIGH" | "MEDIUM" | "LOW" =
    tezaraResults.originalityBadge === "HIGH_RISK" ? "HIGH"
      : tezaraResults.originalityBadge === "MEDIUM_RISK" ? "MEDIUM" : "LOW";

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
        <div className="space-y-2 text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex flex-col sm:flex-row sm:items-center gap-2">
            <span>Akademik Risk & Maddi Doğrulama Raporu</span>
          </h1>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Çalışmanızın internet üzerindeki maddi doğruluğu ile Tezara veri tabanındaki literatür çakışma riskleri.
          </p>
        </div>
        <div className="flex items-center self-end sm:self-center">
          <StartOverButton />
        </div>
      </div>

      {/* Badge & Overall status */}
      <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-card border border-border rounded-xl gap-4">
        <div className="space-y-1 text-center md:text-left">
          <h3 className="text-lg font-semibold text-foreground">Genel Akademik Risk Seviyesi</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Asistanınızın literatür çakışmaları ve kuramsal yaklaşımlar üzerindeki nihai risk değerlendirmesi.
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-3 rounded-full text-xs font-semibold tracking-wider ${badgeColor}`}>
          <Award className="w-5 h-5" />
          <span>{statusTranslation[tezaraResults.originalityBadge] || tezaraResults.originalityBadge}</span>
        </div>
      </div>

      {/* Section A: Tavily Fact Checking */}
      <TavilyFactCheckTable tavilyResults={tavilyResults} />

      {/* Section B: Tezara Cross Literature comparison */}
      <TezaraOverlapTable
        overlapTable={tezaraResults.overlapTable}
        strategicRecommendations={tezaraResults.strategicRecommendations}
      />

      {/* Section C: Strategic Recommendations */}
      <StrategicRoadmapSection
        strategicRecommendations={tezaraResults.strategicRecommendations}
        riskLevel={riskLevel}
        hasOriginalComparisonNotes={hasOriginalComparisonNotes}
      />

      {/* Risk-based actions */}
      {riskLevel === "HIGH" && (
        <div className="flex justify-center">
          <StartOverButton variant="default" className="w-full md:w-auto" />
        </div>
      )}
    </div>
  );
}
