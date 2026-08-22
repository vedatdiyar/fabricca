"use client";

import { Plus, Layers, Hash, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TotalBoxMetrics } from "../../hooks/use-box-data";

interface QuadrantMetricsStripProps {
  totalMetrics: TotalBoxMetrics;
  onAddNewSubBox: () => void;
}

/**
 * Top summary bar with thesis metrics and primary sub-box creation action.
 */
export function QuadrantMetricsStrip({
  totalMetrics,
  onAddNewSubBox,
}: QuadrantMetricsStripProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 border border-border/60 rounded-lg p-3 sm:px-4">
      {/* Metric Pills */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/80 text-foreground font-sans">
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium">4 Ana Eksen</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 text-muted-foreground font-sans">
          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono font-medium text-foreground">
            {totalMetrics.totalConcepts}
          </span>
          <span>Kavram</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 text-muted-foreground font-sans">
          <Library className="h-3.5 w-3.5 text-primary/80" />
          <span className="font-mono font-medium text-foreground">
            {totalMetrics.totalSources}
          </span>
          <span>Kaynak</span>
        </div>
      </div>

      {/* Primary Action */}
      <Button
        onClick={onAddNewSubBox}
        size="sm"
        className="h-8 text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shrink-0"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Yeni Alt Konu Ekle</span>
      </Button>
    </div>
  );
}
