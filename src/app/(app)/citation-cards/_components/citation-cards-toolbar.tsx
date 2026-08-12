"use client";

import { Search, SlidersHorizontal, Plus } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CitationCardFilters } from "../_hooks/use-citation-cards-filter";

/** Turkish display labels dictionary for sorting options. */
const SORT_DISPLAY_LABELS: Record<string, string> = {
  NEWEST: "En Yeni",
  OLDEST: "En Eski",
  SOURCE_TITLE: "Kaynağa Göre",
  PAGE_NUMBER: "Sayfa Numarasına Göre",
};

interface CitationCardsToolbarProps {
  filters: CitationCardFilters;
  onFilterChange: <K extends keyof CitationCardFilters>(
    key: K,
    value: CitationCardFilters[K],
  ) => void;
  resultCount: number;
  onAddNew: () => void;
}

/**
 * Search bar, sort select, note-type filter tabs and add button for the
 * citation cards page.
 *
 * @param root0 - Component props.
 * @param root0.filters - The current filter state.
 * @param root0.onFilterChange - Generic filter updater.
 * @param root0.resultCount - Number of currently visible cards.
 * @param root0.onAddNew - Callback invoked to open the add-card dialog.
 * @returns The citation cards toolbar markup.
 */
export function CitationCardsToolbar({
  filters,
  onFilterChange,
  resultCount,
  onAddNew,
}: CitationCardsToolbarProps) {
  return (
    <Card className="relative z-20 flex flex-col gap-3 rounded-md p-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Alıntı fişi ara"
            placeholder="Fiş içeriği, yazar veya eser adı ara..."
            value={filters.searchQuery}
            onChange={(e) => onFilterChange("searchQuery", e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        {/* Sort & View Mode Controls */}
        <div className="flex items-center gap-2 justify-end">
          <Select
            value={filters.sortBy}
            onValueChange={(v) => onFilterChange("sortBy", v)}
          >
            <SelectTrigger className="w-40 text-xs h-9">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1 text-muted-foreground shrink-0" />
              <SelectValue>{SORT_DISPLAY_LABELS[filters.sortBy]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEWEST">En Yeni</SelectItem>
              <SelectItem value="OLDEST">En Eski</SelectItem>
              <SelectItem value="SOURCE_TITLE">Kaynağa Göre</SelectItem>
              <SelectItem value="PAGE_NUMBER">Sayfa Numarasına Göre</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={onAddNew}
            size="sm"
            className="gap-2 h-8 px-3 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Yeni Fiş</span>
          </Button>
        </div>
      </div>

      {/* Note Type Filter Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pt-1">
        <Tabs
          value={filters.activeNoteTypeTab}
          onValueChange={(v) => onFilterChange("activeNoteTypeTab", v)}
          className="w-full"
        >
          <TabsList className="h-8 text-xs bg-muted">
            <TabsTrigger value="ALL" className="text-xs px-3">
              Tüm Notlar
            </TabsTrigger>
            <TabsTrigger value="DIRECT_QUOTE" className="text-xs px-3">
              Doğrudan Alıntı
            </TabsTrigger>
            <TabsTrigger value="PARAPHRASE" className="text-xs px-3">
              Dolaylı Alıntı
            </TabsTrigger>
            <TabsTrigger value="PERSONAL_NOTE" className="text-xs px-3">
              Kişisel Not
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
          {resultCount} sonuç gösteriliyor
        </span>
      </div>
    </Card>
  );
}
