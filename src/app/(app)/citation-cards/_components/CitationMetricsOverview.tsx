"use client";

import { FileSpreadsheet, Quote, Sparkles, Bookmark } from "lucide-react";
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
      <div className="p-3.5 rounded-md border border-border bg-card backdrop-blur-sm">
        <div className="flex items-center justify-between text-muted-foreground mb-1">
          <span className="text-xs font-medium">Toplam Fiş</span>
          <FileSpreadsheet className="h-4 w-4 text-primary" />
        </div>
        <div className="text-2xl font-bold text-foreground">{totalCount}</div>
      </div>

      <div className="p-3.5 rounded-md border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm">
        <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 mb-1">
          <span className="text-xs font-medium">Doğrudan Alıntı</span>
          <Quote className="h-4 w-4" />
        </div>
        <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
          {quoteCount}
        </div>
      </div>

      <div className="p-3.5 rounded-md border border-blue-500/20 bg-blue-500/5 backdrop-blur-sm">
        <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 mb-1">
          <span className="text-xs font-medium">Dolaylı Alıntı</span>
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
          {paraphraseCount}
        </div>
      </div>

      <div className="p-3.5 rounded-md border border-purple-500/20 bg-purple-500/5 backdrop-blur-sm">
        <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 mb-1">
          <span className="text-xs font-medium">Kişisel Not</span>
          <Bookmark className="h-4 w-4" />
        </div>
        <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
          {noteCount}
        </div>
      </div>
    </div>
  );
}
