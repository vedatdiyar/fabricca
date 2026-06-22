"use client";

import { useMemo } from "react";
import { Layers } from "lucide-react";
import { TavilyFactCheckTable } from "./tavily-fact-check-table";
import { TezaraOverlapTable } from "./tezara-overlap-table";
import { StrategicRoadmapSection } from "./strategic-roadmap-section";
import { getScoreBadge } from "../_services/analysis";
import { BADGE_LABELS, BADGE_COLORS } from "../_lib/constants";
import type { OriginalityReportData } from "@/lib/types";

interface OriginalityReportViewProps {
  reportData: OriginalityReportData;
}

/** Role distribution computed from the overlap table. */
interface RoleDistribution {
  label: string;
  key: "KRITIK_CAKISMA" | "SINIRDAS_CALISMA" | "BESLEYICI_CALISMA";
  count: number;
}

const ROLE_KEYS: RoleDistribution["key"][] = [
  "BESLEYICI_CALISMA",
  "SINIRDAS_CALISMA",
  "KRITIK_CAKISMA",
];

/**
 * Top-level positioning report view. Composes three sub-sections (Tavily
 * fact-check, Tezara overlap matrix, strategic roadmap) and a positioning
 * summary map showing role distribution across compared theses.
 */
export function OriginalityReportView({
  reportData,
}: OriginalityReportViewProps) {
  const { tavilyResults, tezaraResults } = reportData;

  const filteredOverlapTable = useMemo(
    () =>
      (tezaraResults.overlapTable ?? []).filter(
        (item) => getScoreBadge(item.riskScore) !== "OZGUN_CALISMA",
      ),
    [tezaraResults.overlapTable],
  );

  const roleDistribution = useMemo<RoleDistribution[]>(() => {
    const counts: Record<string, number> = {
      BESLEYICI_CALISMA: 0,
      SINIRDAS_CALISMA: 0,
      KRITIK_CAKISMA: 0,
    };
    for (const item of filteredOverlapTable) {
      const badge = getScoreBadge(item.riskScore);
      if (counts[badge] !== undefined) {
        counts[badge]++;
      }
    }
    return ROLE_KEYS.map((key) => ({
      key,
      label: BADGE_LABELS[key] ?? key,
      count: counts[key],
    }));
  }, [filteredOverlapTable]);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
        <div className="space-y-2 text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex flex-col sm:flex-row sm:items-center gap-2">
            <span>Literatür Konumlandırma ve Doğrulama Raporu</span>
          </h1>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Tez matrisinizin akademik literatür içindeki konumu, karşılaştırmalı
            pozisyon analizi ve olgusal doğrulaması.
          </p>
        </div>
      </div>

      {/* Positioning Map: role distribution summary */}
      <div className="p-6 bg-card border border-border rounded-xl space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Akademik Konumlandırma ve Katkı Haritası
          </h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Karşılaştırılan tezlerin çalışmanıza olan katkı türüne göre dağılımı.
        </p>
        <div className="flex flex-wrap gap-3">
          {roleDistribution.map((role) => (
            <div
              key={role.key}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border ${BADGE_COLORS[role.key]}`}
            >
              <span className="text-lg font-bold tabular-nums leading-none">
                {role.count}
              </span>
              <span className="text-xs font-semibold tracking-wide leading-tight">
                {role.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Section A: Tavily Fact Checking */}
      <TavilyFactCheckTable tavilyResults={tavilyResults} />

      {/* Section B: Tezara Cross Literature comparison */}
      <TezaraOverlapTable
        overlapTable={filteredOverlapTable}
        strategicRecommendations={tezaraResults.strategicRecommendations}
      />

      {/* Section C: Strategic Recommendations */}
      <StrategicRoadmapSection
        strategicRecommendations={tezaraResults.strategicRecommendations}
      />
    </div>
  );
}
