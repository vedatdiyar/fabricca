"use client";

import { Card, CardContent } from "@/components/ui/card";

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
    <Card className="p-6 rounded-md">
      <CardContent className="p-0">
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-line font-normal">
          {strategicRecommendations}
        </p>
      </CardContent>
    </Card>
  );
}
