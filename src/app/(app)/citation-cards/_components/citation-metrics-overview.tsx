"use client";

import { Quote, Sparkles, Bookmark, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CitationCardCounts } from "../_hooks/use-citation-cards-filter";

interface CitationMetricsOverviewProps {
  counts: CitationCardCounts;
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

/**
 * Interactive filter pills with live counters for citation cards.
 * Replaces bulky static metric cards with unified, clickable filter buttons.
 *
 * @param props - Component props.
 * @returns Filter pills markup.
 */
export function CitationMetricsOverview({
  counts,
  activeTab,
  onSelectTab,
}: CitationMetricsOverviewProps) {
  const { totalCount, quoteCount, paraphraseCount, noteCount } = counts;

  const filters = [
    {
      id: "ALL",
      label: "Tüm Fişler",
      count: totalCount,
      icon: Layers,
      activeClass: "bg-primary text-primary-foreground border-primary",
      badgeClass: "bg-primary-foreground/20 text-primary-foreground",
    },
    {
      id: "DIRECT_QUOTE",
      label: "Doğrudan Alıntı",
      count: quoteCount,
      icon: Quote,
      activeClass: "bg-primary text-primary-foreground border-primary",
      badgeClass: "bg-primary-foreground/20 text-primary-foreground",
    },
    {
      id: "PARAPHRASE",
      label: "Dolaylı Alıntı",
      count: paraphraseCount,
      icon: Sparkles,
      activeClass: "bg-primary text-primary-foreground border-primary",
      badgeClass: "bg-primary-foreground/20 text-primary-foreground",
    },
    {
      id: "PERSONAL_NOTE",
      label: "Kişisel Not",
      count: noteCount,
      icon: Bookmark,
      activeClass: "bg-primary text-primary-foreground border-primary",
      badgeClass: "bg-primary-foreground/20 text-primary-foreground",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = activeTab === filter.id;

        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onSelectTab(filter.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-150 cursor-pointer select-none",
              isActive
                ? filter.activeClass
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent/20",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{filter.label}</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors",
                isActive
                  ? filter.badgeClass
                  : "bg-muted text-foreground border border-border/40",
              )}
            >
              {filter.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
