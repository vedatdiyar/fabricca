"use client";

import { ShieldAlert } from "lucide-react";
import { TavilyFactCheckTable } from "./tavily-fact-check-table";
import { TezaraOverlapTable } from "./tezara-overlap-table";
import { StrategicRoadmapSection } from "./strategic-roadmap-section";
import { THESIS_BADGE_LABELS, THESIS_BADGE_COLORS } from "../_lib/constants";
import type { OriginalityReportData } from "@/lib/types";

interface OriginalityReportViewProps {
  reportData: OriginalityReportData;
}

/**
 * Top-level positioning report view. Composes three sub-sections (Tavily
 * fact-check, Tezara overlap matrix, strategic roadmap).
 */
export function OriginalityReportView({
  reportData,
}: OriginalityReportViewProps) {
  const { tavilyResults, tezaraResults } = reportData;

  return (
    <div className="space-y-10">
      {/* Global Risk Badge: overall report risk level with percentage */}
      <div
        className={`p-6 rounded-xl border ${THESIS_BADGE_COLORS[tezaraResults.originalityBadge] ?? THESIS_BADGE_COLORS.OZGUN} space-y-3`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-background/60">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Genel Rapor Risk Seviyesi
              </p>
              <h2 className="text-xl font-bold tracking-tight">
                {THESIS_BADGE_LABELS[tezaraResults.originalityBadge] ??
                  tezaraResults.originalityBadge}
              </h2>
            </div>
          </div>
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
      />
    </div>
  );
}
