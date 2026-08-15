"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Hash, Library } from "lucide-react";
import { getQuadrantConfig } from "../../constants/quadrant-config";
import type { BoxWithRelations } from "../../constants/quadrant-config";
import type { PillarMetrics } from "../../hooks/use-box-data";

interface QuadrantMetricsStripProps {
  rootBoxes: BoxWithRelations[];
  pillarMetricsById: Record<number, PillarMetrics>;
}

/** Top overview strip rendering one compact metric card per research quadrant. */
export function QuadrantMetricsStrip({
  rootBoxes,
  pillarMetricsById,
}: QuadrantMetricsStripProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {rootBoxes.map((rootBox) => {
        const config = getQuadrantConfig(rootBox.boxType, rootBox.title);
        const Icon = config.icon;
        const metrics = pillarMetricsById[rootBox.id];

        return (
          <Card
            key={rootBox.id}
            className="border border-border bg-card transition-all hover:border-border/80"
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">
                    Sütun #{config.number}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    • {metrics.subBoxCount} Alt Konu
                  </span>
                </div>
                <p className="font-serif text-sm font-semibold tracking-tight text-foreground truncate">
                  {config.shortLabel}
                </p>
                <div className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5 text-[10px]">
                    <Hash className="h-3 w-3 text-muted-foreground/70" />
                    <span>{metrics.conceptCount} kavram</span>
                  </span>
                  <span className="text-border/60">•</span>
                  <span className="flex items-center gap-0.5 text-[10px]">
                    <Library className="h-3 w-3 text-muted-foreground/70" />
                    <span>{metrics.sourceCount} kaynak</span>
                  </span>
                </div>
              </div>
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${config.accentColor}`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
