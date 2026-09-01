"use client";

import { CheckCircle2 } from "lucide-react";
import { MetricCard } from "@/components/shared/metrics/metric-card";
import { MetricsGrid } from "@/components/shared/metrics/metrics-grid";
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
    <MetricsGrid>
      {MATRIX_CARDS.map((card) => {
        const wordCount = stats.counts[card.key];
        const isFilled = values[card.key]?.trim().length > 0;
        const Icon = card.icon;

        return (
          <MetricCard
            key={card.key}
            label={card.badgeLabel}
            value={wordCount > 0 ? `${wordCount} kelime` : "Veri girilmedi"}
            icon={Icon}
            iconClassName={card.accentColor}
            iconSizeClassName="h-4 w-4"
            labelClassName="font-sans text-xs font-semibold tracking-tight text-foreground truncate"
            valueClassName="font-sans text-[10px] text-muted-foreground"
            topSlot={
              isFilled ? (
                <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Dolu</span>
                </span>
              ) : (
                <span className="text-[10px] font-medium text-muted-foreground">
                  Boş
                </span>
              )
            }
            cardClassName="transition-colors hover:border-border/80"
          />
        );
      })}
    </MetricsGrid>
  );
}
