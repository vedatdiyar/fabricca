"use client";

interface StrategicRoadmapSectionProps {
  /** Yapay zeka tarafından üretilen stratejik yol haritası ve tavsiyeler metni. */
  strategicRecommendations: string;
}

/**
 * StrategicRoadmapSection — özgünlük raporunun C bölümü.
 * Stratejik yol haritası ve akademik konumlandırma tavsiyelerini render eder.
 * Bölüm başlığı üst bileşen (OriginalityReportView) tarafından section divider ile sağlanır.
 *
 * @param props.strategicRecommendations - Gemini tarafından üretilen tavsiyeler metni.
 */
export function StrategicRoadmapSection({
  strategicRecommendations,
}: StrategicRoadmapSectionProps) {
  return (
    <div className="rounded-xl border border-border/20 bg-card p-6">
      <p className="text-sm leading-relaxed text-foreground whitespace-pre-line font-normal">
        {strategicRecommendations}
      </p>
    </div>
  );
}
