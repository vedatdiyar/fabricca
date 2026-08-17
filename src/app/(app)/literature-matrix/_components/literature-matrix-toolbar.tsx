"use client";

import React from "react";
import {
  Search,
  Filter,
  Columns3,
  Download,
  BookOpenCheck,
  RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { MatrixFilterConfig, MatrixColumnVisibility } from "../_lib/types";

interface ColumnDef {
  key: string;
  label: string;
}

interface LiteratureMatrixToolbarProps {
  filters: MatrixFilterConfig;
  onFilterChange: (filters: MatrixFilterConfig) => void;
  availableBoxes: Array<{ id: number; title: string }>;
  columnVisibility: MatrixColumnVisibility;
  allColumns: ColumnDef[];
  onColumnVisibilityChange: (visibility: MatrixColumnVisibility) => void;
  onExportCSV: () => void;
  onResetFilters: () => void;
}

/**
 * Toolbar providing real-time search, box filtering, column toggles, and CSV export for the Literature Matrix.
 *
 * @param root0 - Component props.
 * @param root0.filters - Current filter values.
 * @param root0.onFilterChange - Callback invoked when filters update.
 * @param root0.availableBoxes - List of available topic boxes for dropdown filtering.
 * @param root0.columnVisibility - Current visibility map of matrix columns.
 * @param root0.allColumns - Definitions of all available table columns.
 * @param root0.onColumnVisibilityChange - Callback invoked when column toggles change.
 * @param root0.onExportCSV - Callback to trigger CSV file download.
 * @param root0.onResetFilters - Callback to reset all search/filter states.
 * @returns The toolbar controls markup.
 */
export function LiteratureMatrixToolbar({
  filters,
  onFilterChange,
  availableBoxes,
  columnVisibility,
  allColumns,
  onColumnVisibilityChange,
  onExportCSV,
  onResetFilters,
}: LiteratureMatrixToolbarProps) {
  const hasActiveFilters =
    filters.searchTerm.trim() !== "" ||
    filters.boxId !== "all" ||
    filters.readStatus !== "all";

  const handleToggleColumn = (columnKey: string, checked: boolean) => {
    onColumnVisibilityChange({
      ...columnVisibility,
      [columnKey]: checked,
    });
  };

  const selectedBox =
    filters.boxId === "all"
      ? null
      : availableBoxes.find((b) => b.id === filters.boxId);
  const boxLabel = selectedBox ? selectedBox.title : "Tüm Temalar";

  const statusLabelMap: Record<string, string> = {
    all: "Tüm Durumlar",
    read: "Okunmuş",
    unread: "Okunmamış",
  };
  const statusLabel = statusLabelMap[filters.readStatus] || "Tüm Durumlar";

  return (
    <div className="flex flex-row items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-xs overflow-x-auto scrollbar-none">
      {/* Left Group: Search & Filters strictly side-by-side in single line */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Realtime Search Input */}
        <div className="relative w-64 sm:w-72 md:w-80 shrink-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Makale başlığı, yazar veya içerik ara..."
            value={filters.searchTerm}
            onChange={(e) =>
              onFilterChange({ ...filters, searchTerm: e.target.value })
            }
            className="pl-9.5 text-sm text-foreground bg-background focus-visible:ring-primary h-10 w-full"
          />
        </div>

        {/* Box/Theme Filter */}
        <Select
          value={filters.boxId === "all" ? "all" : String(filters.boxId)}
          onValueChange={(val) =>
            onFilterChange({
              ...filters,
              boxId: val === "all" ? "all" : Number(val),
            })
          }
        >
          <SelectTrigger className="h-10 w-52 text-sm bg-background shrink-0">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
            <SelectValue className="truncate">{boxLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent className="text-sm">
            <SelectItem value="all">
              Tüm Temalar ({availableBoxes.length})
            </SelectItem>
            {availableBoxes.map((box) => (
              <SelectItem key={box.id} value={String(box.id)}>
                {box.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Read Status Filter */}
        <Select
          value={filters.readStatus}
          onValueChange={(val) =>
            onFilterChange({
              ...filters,
              readStatus: val as "all" | "read" | "unread",
            })
          }
        >
          <SelectTrigger className="h-10 w-44 text-sm bg-background shrink-0">
            <BookOpenCheck className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
            <SelectValue>{statusLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent className="text-sm">
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="read">Okunmuş</SelectItem>
            <SelectItem value="unread">Okunmamış</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-10 text-sm text-muted-foreground hover:text-foreground shrink-0"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Sıfırla
          </Button>
        )}
      </div>

      {/* Right Group: Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Column Visibility Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-10 text-sm gap-1.5 px-3.5"
            >
              <Columns3 className="h-4 w-4" />
              <span>Sütunlar</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-3.5 text-sm" align="end">
            <p className="mb-2.5 font-medium text-foreground text-sm">
              Sütun Görünürlüğü
            </p>
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {allColumns.map((col) => (
                <div key={col.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`col-${col.key}`}
                    checked={columnVisibility[col.key] !== false}
                    onCheckedChange={(checked) =>
                      handleToggleColumn(col.key, Boolean(checked))
                    }
                  />
                  <Label
                    htmlFor={`col-${col.key}`}
                    className="text-sm font-normal leading-none cursor-pointer"
                  >
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* CSV Export Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          className="h-10 text-sm gap-1.5 px-3.5 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
        >
          <Download className="h-4 w-4" />
          <span>CSV İndir</span>
        </Button>
      </div>
    </div>
  );
}
