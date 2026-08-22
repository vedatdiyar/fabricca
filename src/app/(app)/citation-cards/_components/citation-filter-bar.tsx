"use client";

import { Search, SlidersHorizontal, X, Box as BoxIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CitationMetricsOverview } from "./citation-metrics-overview";
import type {
  CitationCardFilters,
  CitationCardCounts,
} from "../_hooks/use-citation-cards-filter";
import type { BoxItem, SourceItem } from "../_lib/types";

interface CitationFilterBarProps {
  filters: CitationCardFilters;
  counts: CitationCardCounts;
  boxes: BoxItem[];
  sources: SourceItem[];
  onFilterChange: <K extends keyof CitationCardFilters>(
    key: K,
    value: CitationCardFilters[K],
  ) => void;
}

/**
 * Compact Single-Row Toolbar for Citation Cards.
 *
 * @param props - Component props.
 * @returns Rendered filter bar markup.
 */
export function CitationFilterBar({
  filters,
  counts,
  boxes,
  onFilterChange,
}: CitationFilterBarProps) {
  const selectedBox = boxes.find((b) => b.id === filters.selectedBoxId);
  const boxSelectLabel = selectedBox
    ? `Kutu: ${selectedBox.title}`
    : "Tüm Kutular";

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Search Input + Box Filter + Sort */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            aria-label="Alıntı fişi ara"
            placeholder="Fiş içeriği, yazar, eser veya sayfa ara..."
            value={filters.searchQuery}
            onChange={(e) => onFilterChange("searchQuery", e.target.value)}
            className="pl-8 pr-8 text-xs bg-card border-border"
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

        {/* Filters Group */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Box Filter Select */}
          <div className="w-36">
            <Select
              value={
                filters.selectedBoxId !== null
                  ? String(filters.selectedBoxId)
                  : "ALL"
              }
              onValueChange={(v) =>
                onFilterChange("selectedBoxId", v === "ALL" ? null : Number(v))
              }
            >
              <SelectTrigger className="text-xs bg-card border-border">
                <BoxIcon className="size-3.5 mr-1 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Tüm Kutular">
                  {boxSelectLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="ALL">Tüm Kutular</SelectItem>
                {boxes.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    <span className="truncate">{b.title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort Select */}
          <div className="w-32">
            <Select
              value={filters.sortBy}
              onValueChange={(v) => onFilterChange("sortBy", v)}
            >
              <SelectTrigger className="text-xs bg-card border-border">
                <SlidersHorizontal className="size-3.5 mr-1 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Sıralama" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEWEST">En Yeni</SelectItem>
                <SelectItem value="OLDEST">En Eski</SelectItem>
                <SelectItem value="SOURCE_TITLE">Kaynağa Göre</SelectItem>
                <SelectItem value="PAGE_NUMBER">Sayfa No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Note Type Metric Filter Pills */}
      <div className="flex items-center justify-start pt-0.5">
        <CitationMetricsOverview
          counts={counts}
          activeTab={filters.activeNoteTypeTab}
          onSelectTab={(tab) => onFilterChange("activeNoteTypeTab", tab)}
        />
      </div>
    </div>
  );
}
