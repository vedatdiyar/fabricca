"use client";

import {
  Search,
  SlidersHorizontal,
  X,
  LayoutGrid,
  List,
  Quote,
  Sparkles,
  Bookmark,
  Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  CitationCardFilters,
  CitationCardCounts,
} from "../_hooks/use-citation-cards-filter";
import type { SourceItem } from "../_lib/types";

interface CitationFilterBarProps {
  filters: CitationCardFilters;
  counts: CitationCardCounts;
  sources?: SourceItem[];
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onFilterChange: <K extends keyof CitationCardFilters>(
    key: K,
    value: CitationCardFilters[K],
  ) => void;
}

/**
 * Unified, sleek single-level workspace toolbar for Citation Cards.
 * Integrates search, note type segmented controls, sorting, and view toggle.
 *
 * @param props - Component props.
 * @returns Rendered unified filter bar markup.
 */
export function CitationFilterBar({
  filters,
  counts,
  viewMode,
  onViewModeChange,
  onFilterChange,
}: CitationFilterBarProps) {
  const noteTypeTabs = [
    {
      id: "ALL",
      label: "Tümü",
      count: counts.totalCount,
      icon: Layers,
    },
    {
      id: "DIRECT_QUOTE",
      label: "Doğrudan",
      count: counts.quoteCount,
      icon: Quote,
    },
    {
      id: "PARAPHRASE",
      label: "Dolaylı",
      count: counts.paraphraseCount,
      icon: Sparkles,
    },
    {
      id: "PERSONAL_NOTE",
      label: "Kişisel",
      count: counts.noteCount,
      icon: Bookmark,
    },
  ];

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 w-full bg-card/40 border border-border/40 p-1.5 rounded-xl">
      {/* 1. Left: Search Input */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          aria-label="Alıntı fişi ara"
          placeholder="Fiş içeriği, yazar, eser veya sayfa ara..."
          value={filters.searchQuery}
          onChange={(e) => onFilterChange("searchQuery", e.target.value)}
          className="pl-8 pr-8 text-xs h-8 bg-background/80 border-border/40 rounded-lg placeholder:text-muted-foreground/60"
        />
        {filters.searchQuery && (
          <button
            type="button"
            onClick={() => onFilterChange("searchQuery", "")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* 2. Middle: Note Type Segmented Control */}
      <div className="flex items-center gap-0.5 bg-muted/30 p-0.5 rounded-lg border border-border/30 overflow-x-auto shrink-0">
        {noteTypeTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = filters.activeNoteTypeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onFilterChange("activeNoteTypeTab", tab.id)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer select-none shrink-0",
                isActive
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3 shrink-0" />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "font-mono text-[10px] ml-0.5",
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground/60",
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Right: Sort + View Mode Switcher */}
      <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
        {/* Sort Select */}
        <div className="w-28">
          <Select
            value={filters.sortBy}
            onValueChange={(v) => onFilterChange("sortBy", v)}
          >
            <SelectTrigger className="h-8 text-xs bg-background border-border/60">
              <SlidersHorizontal className="size-3 mr-1 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Sıralama" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="NEWEST">En Yeni</SelectItem>
              <SelectItem value="OLDEST">En Eski</SelectItem>
              <SelectItem value="SOURCE_TITLE">Kaynağa Göre</SelectItem>
              <SelectItem value="PAGE_NUMBER">Sayfa No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Mode Switcher (Grid / List) */}
        <div className="flex items-center bg-muted/40 p-0.5 rounded-md border border-border/40">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "h-7 w-7 rounded cursor-pointer",
              viewMode === "grid"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Kart Görünümü"
          >
            <LayoutGrid className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onViewModeChange("list")}
            className={cn(
              "h-7 w-7 rounded cursor-pointer",
              viewMode === "list"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Liste Görünümü"
          >
            <List className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
