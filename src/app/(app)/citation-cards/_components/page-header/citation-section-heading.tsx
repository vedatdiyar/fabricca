"use client";

import { AlertCircle, FolderTree, Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OutlineItem } from "../../_lib/types";

interface CitationCardsSectionHeadingProps {
  unassignedOnly: boolean;
  activeOutline?: OutlineItem;
  activeBoxTitle?: string | null;
  cardCount: number;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

/**
 * Contextual heading indicating the current active outline chapter or filter status.
 *
 * @param props - Component props.
 * @returns Heading markup.
 */
export function CitationCardsSectionHeading({
  unassignedOnly,
  activeOutline,
  activeBoxTitle,
  cardCount,
  hasFilters,
  onClearFilters,
}: CitationCardsSectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-3 pb-1 border-b border-border/40 min-h-[32px]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {unassignedOnly ? (
          <>
            <AlertCircle className="size-4 text-warning shrink-0" />
            <h2 className="font-serif text-sm font-semibold text-warning truncate">
              Bölüme Atanmamış Fişler Havuzu
            </h2>
          </>
        ) : activeOutline ? (
          <>
            <FolderTree className="size-4 text-primary shrink-0" />
            <div className="flex items-baseline gap-1.5 truncate">
              <h2 className="font-serif text-sm font-semibold text-foreground truncate">
                {activeOutline.title}
              </h2>
              {activeOutline.description && (
                <span className="text-xs text-muted-foreground truncate hidden lg:inline">
                  — {activeOutline.description}
                </span>
              )}
            </div>
          </>
        ) : activeBoxTitle ? (
          <>
            <Layers className="size-4 text-primary shrink-0" />
            <h2 className="font-serif text-sm font-semibold text-foreground truncate">
              Kutu: {activeBoxTitle}
            </h2>
          </>
        ) : (
          <>
            <Layers className="size-4 text-primary shrink-0" />
            <h2 className="font-serif text-sm font-semibold text-foreground truncate">
              Tüm Alıntı Fişleri
            </h2>
          </>
        )}

        {hasFilters && onClearFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
          >
            <X className="size-3" />
            <span>Filtreleri Temizle</span>
          </Button>
        )}
      </div>

      <span className="font-mono text-xs text-muted-foreground shrink-0">
        {cardCount} Fiş
      </span>
    </div>
  );
}
