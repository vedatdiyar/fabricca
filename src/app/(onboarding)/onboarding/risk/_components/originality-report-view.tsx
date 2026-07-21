"use client";

import { TezaraOverlapCards } from "./tezara-overlap-cards";
import type { OriginalityReportData } from "@/lib/types";

interface OriginalityReportViewProps {
  reportData: OriginalityReportData;
}

/**
 * OriginalityReportView — ilişki raporunun üst düzey görünümü.
 * Tezara karşılaştırma matrisini render eder.
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
        <TezaraOverlapCards overlapTable={tezaraResults.overlapTable} />
      </div>
    </div>
  );
}
