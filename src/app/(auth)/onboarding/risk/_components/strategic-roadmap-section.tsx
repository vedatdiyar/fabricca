"use client";

import { Compass } from "lucide-react";

interface StrategicRoadmapSectionProps {
  /** Strategic recommendations / roadmap text to display. */
  strategicRecommendations: string;
}

/**
 * Renders Section C of the positioning report: the strategic roadmap and
 * academic positioning recommendations.
 */
export function StrategicRoadmapSection({
  strategicRecommendations,
}: StrategicRoadmapSectionProps) {

  return (
    <div className="p-6 bg-card border border-border rounded-xl space-y-3 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Compass className="w-5 h-5 text-primary" />
        Yol Haritası ve Akademik Tavsiyeler
      </h3>
      <div className="text-sm leading-loose text-foreground font-light whitespace-pre-line bg-muted p-4 border border-border rounded-lg">
        {strategicRecommendations}
      </div>
    </div>
  );
}
