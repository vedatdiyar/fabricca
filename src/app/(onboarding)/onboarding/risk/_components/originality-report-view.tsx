"use client";

import { TezaraOverlapCards } from "./tezara-overlap-cards";
import type { OriginalityReportData } from "@/lib/types";

interface OriginalityReportViewProps {
  reportData: OriginalityReportData;
}

/** Section divider — matrix tasarım diliyle tutarlı bölüm ayırıcı. */
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
 * OriginalityReportView — ilişki raporunun üst düzey görünümü.
 * Global ilişki profili rozeti + Tezara karşılaştırma matrisi + elenen tezler
 * section divider'larla ayrılmış olarak render eder (Yol Haritası kaldırılmıştır).
 *
 * @param props.reportData - Jüri analizi sonucu oluşturulan ilişki raporu verisi.
 */
export function OriginalityReportView({
  reportData,
}: OriginalityReportViewProps) {
  const { tezaraResults } = reportData;

  return (
    <div className="space-y-8">
      {/* Bölüm A: Tez Karşılaştırma Matrisi */}
      <div className="space-y-5">
        <SectionDivider label="Pozisyon Matrisi" />
        <TezaraOverlapCards overlapTable={tezaraResults.overlapTable} />
      </div>

      {/* Bölüm B: Jüri Tarafından Elenenler */}
      <div className="space-y-5">
        <SectionDivider label="Jüri Tarafından Elenenler" />
        <TezaraOverlapCards overlapTable={tezaraResults.eliminatedTheses} />
      </div>
    </div>
  );
}
