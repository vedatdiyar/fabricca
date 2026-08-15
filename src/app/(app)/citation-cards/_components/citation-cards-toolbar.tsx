"use client";

import { Search, SlidersHorizontal, Plus, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CitationMetricsOverview } from "./citation-metrics-overview";
import type {
  CitationCardFilters,
  CitationCardCounts,
} from "../_hooks/use-citation-cards-filter";

/** Turkish display labels dictionary for sorting options. */
const SORT_DISPLAY_LABELS: Record<string, string> = {
  NEWEST: "En Yeni",
  OLDEST: "En Eski",
  SOURCE_TITLE: "Kaynağa Göre",
  PAGE_NUMBER: "Sayfa No",
};

interface CitationCardsToolbarProps {
  filters: CitationCardFilters;
  counts: CitationCardCounts;
  onFilterChange: <K extends keyof CitationCardFilters>(
    key: K,
    value: CitationCardFilters[K],
  ) => void;
  resultCount: number;
  onAddNew: () => void;
  selectedBoxTitle?: string;
  selectedSourceTitle?: string;
  onClearAllFilters: () => void;
}

/**
 * Search bar, sort select, note-type live filter pills and add button for citation cards.
 *
 * @param props - Component props.
 * @returns The citation cards toolbar markup.
 */
export function CitationCardsToolbar({
  filters,
  counts,
  onFilterChange,
  resultCount,
  onAddNew,
  selectedBoxTitle,
  selectedSourceTitle,
  onClearAllFilters,
}: CitationCardsToolbarProps) {
  const hasSpecialFilters =
    filters.selectedBoxId !== null ||
    filters.selectedSourceId !== null ||
    filters.searchQuery.trim() !== "";

  return (
    <Card className="flex flex-col gap-3 rounded-md p-3.5 border-border">
      {/* Row 1: Search Bar + Sort + Add Button */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            aria-label="Alıntı fişi ara"
            placeholder="Fiş içeriği, yazar, eser veya sayfa ara..."
            value={filters.searchQuery}
            onChange={(e) => onFilterChange("searchQuery", e.target.value)}
            className="pl-9 pr-8 text-xs h-9 bg-background border-border"
          />
          {filters.searchQuery && (
            <button
              type="button"
              onClick={() => onFilterChange("searchQuery", "")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Controls Row: Sort & Add Button */}
        <div className="flex items-center gap-2 justify-end shrink-0">
          {/* Sort Select */}
          <Select
            value={filters.sortBy}
            onValueChange={(v) => onFilterChange("sortBy", v)}
          >
            <SelectTrigger className="w-36 text-xs h-9 bg-background border-border">
              <SlidersHorizontal className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
              <SelectValue>{SORT_DISPLAY_LABELS[filters.sortBy]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEWEST">En Yeni Ekleme</SelectItem>
              <SelectItem value="OLDEST">En Eski Ekleme</SelectItem>
              <SelectItem value="SOURCE_TITLE">Kaynağa Göre (A-Z)</SelectItem>
              <SelectItem value="PAGE_NUMBER">Sayfa Numarasına Göre</SelectItem>
            </SelectContent>
          </Select>

          {/* Add New Card Button */}
          <Button
            onClick={onAddNew}
            size="sm"
            className="gap-1.5 h-9 px-3 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Yeni Fiş</span>
          </Button>
        </div>
      </div>

      {/* Row 2: Note Type Filter Pills (Tüm Fişler, Doğrudan, Dolaylı, Kişisel Not) & Result Count */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
        <CitationMetricsOverview
          counts={counts}
          activeTab={filters.activeNoteTypeTab}
          onSelectTab={(tab) => onFilterChange("activeNoteTypeTab", tab)}
        />

        <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
          <span className="font-semibold text-foreground">{resultCount}</span>{" "}
          fiş gösteriliyor
        </span>
      </div>

      {/* Row 3: Active Context Filters (Box, Source, Search Query) */}
      {hasSpecialFilters && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Aktif Filtre:
            </span>

            {/* Active Box Chip */}
            {selectedBoxTitle && (
              <Badge
                variant="outline"
                className="gap-1 bg-primary/10 text-primary border-primary/20 text-[10px] pl-2 pr-1 py-0.5"
              >
                <span className="truncate max-w-[140px]">
                  Kutu: {selectedBoxTitle}
                </span>
                <button
                  type="button"
                  onClick={() => onFilterChange("selectedBoxId", null)}
                  className="hover:bg-primary/20 rounded p-0.5 cursor-pointer"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}

            {/* Active Source Chip */}
            {selectedSourceTitle && (
              <Badge
                variant="outline"
                className="gap-1 bg-info/10 text-info border-info/20 text-[10px] pl-2 pr-1 py-0.5"
              >
                <span className="truncate max-w-[140px]">
                  Kaynak: {selectedSourceTitle}
                </span>
                <button
                  type="button"
                  onClick={() => onFilterChange("selectedSourceId", null)}
                  className="hover:bg-info/20 rounded p-0.5 cursor-pointer"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}

            {/* Active Search Query Chip */}
            {filters.searchQuery && (
              <Badge
                variant="outline"
                className="gap-1 bg-muted text-muted-foreground border-border text-[10px] pl-2 pr-1 py-0.5"
              >
                <span className="truncate max-w-[120px]">
                  &quot;{filters.searchQuery}&quot;
                </span>
                <button
                  type="button"
                  onClick={() => onFilterChange("searchQuery", "")}
                  className="hover:bg-accent/20 rounded p-0.5 cursor-pointer"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}

            {/* Clear All Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAllFilters}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Filtreleri Sıfırla
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
