"use client";

import { AlertCircle, FolderTree, Layers } from "lucide-react";
import type { OutlineItem } from "../../_lib/types";
interface CitationCardsSectionHeadingProps {
  unassignedOnly: boolean;
  activeOutline?: OutlineItem;
  cardCount: number;
}

export function CitationCardsSectionHeading({
  unassignedOnly,
  activeOutline,
  cardCount,
}: CitationCardsSectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/40">
      <div className="flex items-center gap-2 min-w-0">
        {unassignedOnly ? (
          <>
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <h2 className="font-serif text-sm font-semibold text-amber-600 dark:text-amber-400 truncate">
              Henüz Bir Tez Bölümüne Atanmamış Fişler Havuzu
            </h2>
          </>
        ) : activeOutline ? (
          <>
            <FolderTree className="h-4 w-4 text-primary shrink-0" />
            <h2 className="font-serif text-sm font-semibold text-foreground truncate">
              {activeOutline.title}
            </h2>
            {activeOutline.description && (
              <span className="text-xs text-muted-foreground truncate hidden md:inline">
                — {activeOutline.description}
              </span>
            )}
          </>
        ) : (
          <>
            <Layers className="h-4 w-4 text-primary shrink-0" />
            <h2 className="font-serif text-sm font-semibold text-foreground truncate">
              Tüm Alıntı Fişleri
            </h2>
          </>
        )}
      </div>

      <span className="font-mono text-xs text-muted-foreground shrink-0">
        {cardCount} Fiş
      </span>
    </div>
  );
}
