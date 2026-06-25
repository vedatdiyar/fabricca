"use client";

import { ShieldAlert } from "lucide-react";
import { TavilyFactCheckTable } from "./tavily-fact-check-table";
import { TezaraOverlapTable } from "./tezara-overlap-table";
import { StrategicRoadmapSection } from "./strategic-roadmap-section";
import {
  THESIS_BADGE_LABELS,
  THESIS_BADGE_COLORS,
  THESIS_BADGE_ICON_BG,
  THESIS_BADGE_TEXT,
} from "../_lib/constants";
import type { OriginalityReportData } from "@/lib/types";

interface OriginalityReportViewProps {
  reportData: OriginalityReportData;
}

/** Section divider — matrix/enrichment tasarım diliyle tutarlı bölüm ayırıcı. */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * OriginalityReportView — özgünlük raporunun üst düzey görünümü.
 * Global risk rozeti + 3 bölümlü rapor yapısını (Tavily, Tezara, Yol Haritası)
 * section divider'larla ayrılmış olarak render eder.
 *
 * @param props.reportData - Jüri analizi sonucu oluşturulan özgünlük raporu verisi.
 */
export function OriginalityReportView({
  reportData,
}: OriginalityReportViewProps) {
  const { tavilyResults, tezaraResults } = reportData;

  return (
    <div className="space-y-8">
      {/* Global Risk Rozeti */}
      <div
        className={`flex items-center gap-3 rounded-md border p-4 ${THESIS_BADGE_COLORS[tezaraResults.originalityBadge] ?? THESIS_BADGE_COLORS.OZGUN}`}
      >
        <div
          className={`shrink-0 rounded-md p-2 ${THESIS_BADGE_ICON_BG[tezaraResults.originalityBadge] ?? THESIS_BADGE_ICON_BG.OZGUN}`}
        >
          <ShieldAlert
            className={`h-5 w-5 ${THESIS_BADGE_TEXT[tezaraResults.originalityBadge] ?? THESIS_BADGE_TEXT.OZGUN}`}
          />
        </div>
        <div className="flex flex-1 items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Genel Rapor Risk Seviyesi
          </p>
          <span
            className={`rounded-md border px-2.5 py-0.5 text-sm font-bold ${THESIS_BADGE_COLORS[tezaraResults.originalityBadge] ?? THESIS_BADGE_COLORS.OZGUN}`}
          >
            {THESIS_BADGE_LABELS[tezaraResults.originalityBadge] ??
              tezaraResults.originalityBadge}
          </span>
        </div>
      </div>

      {/* Bölüm A: Maddi Doğrulama */}
      <div className="space-y-5">
        <SectionDivider label="Doğrulama ve Güvence" />
        <TavilyFactCheckTable tavilyResults={tavilyResults} />
      </div>

      {/* Bölüm B: Tez Karşılaştırma Matrisi */}
      <div className="space-y-5">
        <SectionDivider label="Pozisyon Matrisi" />
        <TezaraOverlapTable
          overlapTable={tezaraResults.overlapTable}
          strategicRecommendations={tezaraResults.strategicRecommendations}
        />
      </div>

      {/* Bölüm C: Yol Haritası */}
      <div className="space-y-5">
        <SectionDivider label="Yol Haritası" />
        <StrategicRoadmapSection
          strategicRecommendations={tezaraResults.strategicRecommendations}
        />
      </div>
    </div>
  );
}
