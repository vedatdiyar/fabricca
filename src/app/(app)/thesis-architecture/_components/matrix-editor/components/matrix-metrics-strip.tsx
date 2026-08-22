"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { MATRIX_CARDS } from "../constants/matrix-cards";
import type { MatrixStats } from "../hooks/use-matrix-stats";
import type { MatrixValues } from "../hooks/use-matrix-values";

interface MatrixMetricsStripProps {
  values: MatrixValues;
  stats: MatrixStats;
}

/**
 * Renders the top four-column overview strip with per-pillar status
 * (filled/empty) and word count summary cards.
 *
 * @param root0 - Component props.
 * @param root0.values - The current matrix pillar values.
 * @param root0.stats - The derived matrix statistics.
 */
export function MatrixMetricsStrip({ values, stats }: MatrixMetricsStripProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {MATRIX_CARDS.map((card) => {
        const wordCount = stats.counts[card.key];
        const isFilled = values[card.key]?.trim().length > 0;
        const Icon = card.icon;

        return (
          <Card
            key={card.key}
            className="border border-border bg-card transition-colors hover:border-border/80"
          >
            <CardContent className="flex items-center justify-between p-3">
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Sütun #{card.number}
                  </span>
                  {isFilled ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Dolu</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Boş
                    </span>
                  )}
                </div>
                <p className="font-sans text-xs font-semibold tracking-tight text-foreground truncate">
                  {card.badgeLabel}
                </p>
                <p className="font-sans text-[10px] text-muted-foreground">
                  {wordCount > 0 ? `${wordCount} kelime` : "Veri girilmedi"}
                </p>
              </div>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${card.accentColor}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
