"use client";

import { BookOpen, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourceItem, CitationCardItem } from "../_lib/types";

interface SidebarSourceListProps {
  sources: SourceItem[];
  cards: CitationCardItem[];
  selectedBoxId: number | null;
  selectedSourceId: number | null;
  onSelectSource: (id: number | null) => void;
}

/**
 * Renders the linked sources list of the citation sidebar with per-source card
 * counts and selection highlighting.
 *
 * @param props - Source list props.
 * @returns The source list markup.
 */
export function SidebarSourceList({
  sources,
  cards,
  selectedBoxId,
  selectedSourceId,
  onSelectSource,
}: SidebarSourceListProps) {
  return (
    <div className="space-y-1.5 min-w-0 pb-2">
      <div className="px-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-3 w-3 text-info" />
          Kaynaklar
        </span>
        {selectedBoxId ? (
          <span className="text-[10px] text-primary font-medium">
            (Kutuya Bağlı: {sources.length})
          </span>
        ) : (
          <span className="font-mono text-[10px]">({sources.length})</span>
        )}
      </div>

      {sources.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground italic bg-muted/20 rounded-md border border-border/40">
          Kaynak bulunamadı.
        </div>
      ) : (
        <div className="space-y-1">
          {sources.map((source) => {
            const isSourceSelected = selectedSourceId === source.id;
            const sourceCardCount = cards.filter(
              (c) => c.sourceId === source.id,
            ).length;

            return (
              <button
                key={source.id}
                type="button"
                onClick={() =>
                  onSelectSource(isSourceSelected ? null : source.id)
                }
                className={cn(
                  "w-full text-left p-2 rounded-md transition-all border flex items-center justify-between gap-2 cursor-pointer select-none",
                  isSourceSelected
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-card/50 border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/20 hover:border-border",
                )}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-xs truncate block font-medium",
                      isSourceSelected
                        ? "text-primary font-semibold"
                        : "text-foreground",
                    )}
                    title={source.title}
                  >
                    {source.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {source.authors[0] ?? "Bilinmeyen Yazar"} (
                    {source.publicationYear})
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isSourceSelected && (
                    <Check className="h-3 w-3 text-primary shrink-0" />
                  )}
                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-muted text-foreground border border-border/40 shrink-0">
                    {sourceCardCount}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
