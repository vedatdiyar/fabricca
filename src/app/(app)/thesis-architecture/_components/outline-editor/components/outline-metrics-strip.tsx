"use client";

import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Layers, FileText, Quote } from "lucide-react";
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {/* Metric 1: Root Chapters */}
      <Card className="border border-border bg-card transition-colors hover:border-border/80">
        <CardContent className="flex items-center justify-between p-3">
          <div className="space-y-0.5 min-w-0 flex-1">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Ana Bölümler
            </span>
            <p className="font-mono text-xs font-semibold tracking-tight text-foreground">
              {metrics.totalRoots} Bölüm
            </p>
            <p className="font-sans text-xs text-muted-foreground truncate">
              Hiyerarşik ana başlıklar
            </p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <BookOpen className="size-3.5" />
          </div>
        </CardContent>
      </Card>

      {/* Metric 2: Sub-sections */}
      <Card className="border border-border bg-card transition-colors hover:border-border/80">
        <CardContent className="flex items-center justify-between p-3">
          <div className="space-y-0.5 min-w-0 flex-1">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Alt Başlıklar
            </span>
            <p className="font-mono text-xs font-semibold tracking-tight text-foreground">
              {metrics.totalSubs} Alt Bölüm
            </p>
            <p className="font-sans text-xs text-muted-foreground truncate">
              Detaylı alt araştırma başlıkları
            </p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <Layers className="size-3.5" />
          </div>
        </CardContent>
      </Card>

      {/* Metric 3: Linked Sources */}
      <Card className="border border-border bg-card transition-colors hover:border-border/80">
        <CardContent className="flex items-center justify-between p-3">
          <div className="space-y-0.5 min-w-0 flex-1">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Bağlı Literatür
            </span>
            <p className="font-mono text-xs font-semibold tracking-tight text-foreground">
              {metrics.totalSources} Kaynak
            </p>
            <p className="font-sans text-xs text-muted-foreground truncate">
              Bölümlere doğrudan bağlı eserler
            </p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <FileText className="size-3.5" />
          </div>
        </CardContent>
      </Card>

      {/* Metric 4: Pinned Citation Cards */}
      <Card className="border border-border bg-card transition-colors hover:border-border/80">
        <CardContent className="flex items-center justify-between p-3">
          <div className="space-y-0.5 min-w-0 flex-1">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              İliştirilmiş Fişler
            </span>
            <p className="font-mono text-xs font-semibold tracking-tight text-foreground">
              {metrics.totalCards} Fiş
            </p>
            <p className="font-sans text-xs text-muted-foreground truncate">
              Bölümlere bağlı alıntı kartları
            </p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <Quote className="size-3.5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
