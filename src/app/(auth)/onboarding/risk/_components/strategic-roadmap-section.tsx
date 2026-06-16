"use client";

import { Compass } from "lucide-react";

interface StrategicRoadmapSectionProps {
  /** Strategic recommendations / roadmap text to display. */
  strategicRecommendations: string;
  /** Coarse risk level used to decide whether to render the section. */
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  /** Whether the overlap table carries any genuine comparison notes. */
  hasOriginalComparisonNotes: boolean;
}

/**
 * Renders Section C of the originality report: the strategic roadmap and
 * academic recommendations. Only shown when the risk level is not LOW and the
 * overlap table actually contains genuine comparison notes (i.e. not all rows
 * fell back to the legacy roadmap-distribution format).
 */
export function StrategicRoadmapSection({
  strategicRecommendations,
  riskLevel,
  hasOriginalComparisonNotes,
}: StrategicRoadmapSectionProps) {
  if (riskLevel === "LOW" || !hasOriginalComparisonNotes) {
    return null;
  }

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
