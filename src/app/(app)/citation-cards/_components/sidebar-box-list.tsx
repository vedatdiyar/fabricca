"use client";

import { Layers, Check } from "lucide-react";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { cn } from "@/lib/utils";
import type { BoxItem, CitationCardItem } from "../_lib/types";

interface SidebarBoxListProps {
  boxes: BoxItem[];
  cards: CitationCardItem[];
  selectedBoxId: number | null;
  onSelectBox: (id: number | null) => void;
  onSelectSource: (id: number | null) => void;
}

/**
 * Renders the topic boxes list of the citation sidebar with per-box card
 * counts and selection highlighting.
 *
 * @param props - Box list props.
 * @returns The box list markup.
 */
export function SidebarBoxList({
  boxes,
  cards,
  selectedBoxId,
  onSelectBox,
  onSelectSource,
}: SidebarBoxListProps) {
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="px-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-primary" />
          Tez Konu Kutuları
        </span>
        <span className="font-mono text-[10px]">({boxes.length})</span>
      </div>

      {boxes.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground italic bg-muted/20 rounded-md border border-border/40">
          Aramaya uygun kutu bulunamadı.
        </div>
      ) : (
        <div className="space-y-1">
          {boxes.map((box) => {
            const isSelected = selectedBoxId === box.id;
            const boxConfig = getBoxTypeBadgeConfig(box.boxType);
            const boxCardCount = cards.filter((c) => c.boxId === box.id).length;

            return (
              <button
                key={box.id}
                type="button"
                onClick={() => {
                  onSelectBox(isSelected ? null : box.id);
                  onSelectSource(null);
                }}
                className={cn(
                  "w-full text-left p-2 rounded-md transition-all border flex flex-col gap-1 cursor-pointer select-none",
                  isSelected
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-card/50 border-border/60 hover:border-border hover:bg-accent/20 text-foreground",
                )}
              >
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        boxConfig.dotClassName,
                      )}
                    />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                      {boxConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && (
                      <Check className="h-3 w-3 text-primary shrink-0" />
                    )}
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-muted text-foreground border border-border/40 shrink-0">
                      {boxCardCount}
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    "text-xs font-medium truncate min-w-0",
                    isSelected
                      ? "text-primary font-semibold"
                      : "text-foreground",
                  )}
                  title={box.title}
                >
                  {box.title}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}