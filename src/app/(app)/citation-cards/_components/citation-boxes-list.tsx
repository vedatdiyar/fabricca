"use client";

import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { cn } from "@/lib/utils";
import type { BoxItem, CitationCardItem } from "../_lib/types";

export interface CitationBoxesListProps {
  boxes: BoxItem[];
  cards: CitationCardItem[];
  selectedBoxId: number | null;
  onSelectBox: (boxId: number | null) => void;
}

/**
 * Renders the list of thesis topic boxes for the citation cards sidebar navigation.
 *
 * @param props - Box list data, cards collection, and selection handler.
 * @returns Topic boxes list element.
 */
export function CitationBoxesList({
  boxes,
  cards,
  selectedBoxId,
  onSelectBox,
}: CitationBoxesListProps) {
  return (
    <div className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-1">
      {boxes.map((box) => {
        const boxConfig = getBoxTypeBadgeConfig(box.boxType);
        const isBoxSelected = selectedBoxId === box.id;
        const boxCardsCount = cards.filter((c) => c.boxId === box.id).length;

        return (
          <button
            key={box.id}
            type="button"
            onClick={() => onSelectBox(isBoxSelected ? null : box.id)}
            className={cn(
              "w-full flex items-start justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-left select-none gap-2",
              isBoxSelected
                ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0 mt-1",
                  boxConfig.dotClassName,
                )}
              />
              <span className="text-xs leading-snug break-words whitespace-normal flex-1">
                {box.title}
              </span>
            </div>

            <span className="font-mono text-[10px] text-muted-foreground shrink-0 ml-1 mt-0.5">
              {boxCardsCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}
