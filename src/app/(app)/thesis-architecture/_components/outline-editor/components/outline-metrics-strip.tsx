"use client";

import { BookOpen, Layers, FileText, Quote } from "lucide-react";
import { MetricCard } from "@/components/shared/metrics/metric-card";
import { MetricsGrid } from "@/components/shared/metrics/metrics-grid";
import { OutlineMetrics } from "../hooks/use-outline-metrics";

interface OutlineMetricsStripProps {
  metrics: OutlineMetrics;
}

/**
 * Renders the four top-level metric cards (root chapters, sub-sections,
 * linked sources, pinned citation cards) for the outline editor.
 *
 * @param root0 - Component props.
 * @param root0.metrics - The derived outline metrics to display.
 */
export function OutlineMetricsStrip({ metrics }: OutlineMetricsStripProps) {
  return (
    <MetricsGrid variant="outline-tight">
      <MetricCard
        label="Ana Bölümler"
        value={`${metrics.totalRoots} Bölüm`}
        subtext="Hiyerarşik ana başlıklar"
        icon={BookOpen}
        labelClassName="font-mono text-xs uppercase tracking-wider text-muted-foreground"
        valueClassName="font-mono text-xs font-semibold tracking-tight text-foreground"
        subtextClassName="font-sans text-xs text-muted-foreground truncate"
        cardClassName="transition-colors hover:border-border/80"
      />
      <MetricCard
        label="Alt Başlıklar"
        value={`${metrics.totalSubs} Alt Bölüm`}
        subtext="Detaylı alt araştırma başlıkları"
        icon={Layers}
        labelClassName="font-mono text-xs uppercase tracking-wider text-muted-foreground"
        valueClassName="font-mono text-xs font-semibold tracking-tight text-foreground"
        subtextClassName="font-sans text-xs text-muted-foreground truncate"
        cardClassName="transition-colors hover:border-border/80"
      />
      <MetricCard
        label="Bağlı Literatür"
        value={`${metrics.totalSources} Kaynak`}
        subtext="Bölümlere doğrudan bağlı eserler"
        icon={FileText}
        labelClassName="font-mono text-xs uppercase tracking-wider text-muted-foreground"
        valueClassName="font-mono text-xs font-semibold tracking-tight text-foreground"
        subtextClassName="font-sans text-xs text-muted-foreground truncate"
        cardClassName="transition-colors hover:border-border/80"
      />
      <MetricCard
        label="İliştirilmiş Fişler"
        value={`${metrics.totalCards} Fiş`}
        subtext="Bölümlere bağlı alıntı kartları"
        icon={Quote}
        labelClassName="font-mono text-xs uppercase tracking-wider text-muted-foreground"
        valueClassName="font-mono text-xs font-semibold tracking-tight text-foreground"
        subtextClassName="font-sans text-xs text-muted-foreground truncate"
        cardClassName="transition-colors hover:border-border/80"
      />
    </MetricsGrid>
  );
}
