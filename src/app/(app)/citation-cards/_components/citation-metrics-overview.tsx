"use client";

import { FileSpreadsheet, Quote, Sparkles, Bookmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { CitationCardCounts } from "../_hooks/use-citation-cards-filter";

interface CitationMetricsOverviewProps {
  counts: CitationCardCounts;
}

/**
 * Summary metric cards showing total and per-note-type citation card counts.
 *
 * @param root0 - Component props.
 * @param root0.counts - The aggregated card counts.
 * @returns The metrics overview markup.
 */
export function CitationMetricsOverview({
  counts,
}: CitationMetricsOverviewProps) {
  const { totalCount, quoteCount, paraphraseCount, noteCount } = counts;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card className="p-4 rounded-md backdrop-blur-sm">
        <div className="flex items-center justify-between text-muted-foreground mb-1">
          <span className="text-xs font-medium">Toplam Fiş</span>
          <FileSpreadsheet className="h-4 w-4 text-primary" />
        </div>
        <div className="text-2xl font-bold text-foreground">{totalCount}</div>
      </Card>

      <div className="p-4 rounded-md border border-warning/20 bg-warning/10 backdrop-blur-sm">
        <div className="flex items-center justify-between text-warning mb-1">
          <span className="text-xs font-medium">Doğrudan Alıntı</span>
          <Quote className="h-4 w-4" />
        </div>
        <div className="text-2xl font-bold text-warning">{quoteCount}</div>
      </div>

      <div className="p-4 rounded-md border border-info/20 bg-info/10 backdrop-blur-sm">
        <div className="flex items-center justify-between text-info mb-1">
          <span className="text-xs font-medium">Dolaylı Alıntı</span>
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="text-2xl font-bold text-info">{paraphraseCount}</div>
      </div>

      <div className="p-4 rounded-md border border-accent/20 bg-accent/10 backdrop-blur-sm">
        <div className="flex items-center justify-between text-accent-foreground mb-1">
          <span className="text-xs font-medium">Kişisel Not</span>
          <Bookmark className="h-4 w-4" />
        </div>
        <div className="text-2xl font-bold text-accent-foreground">
          {noteCount}
        </div>
      </div>
    </div>
  );
}
