"use client";

import { Outline, Source } from "@/db/schema";
import { countLinkedSources } from "../../utils/outline-helpers";

interface OutlineSubItemProps {
  outline: Outline;
  rootIndex: number;
  subIndex: number;
  isSelected: boolean;
  linkedBoxIds: number[];
  sourcesList: Source[];
  onSelect: () => void;
}

/**
 * Sub-section row nested under its root chapter in the outline tree.
 *
 * @param root0 - Component props.
 * @param root0.outline - The sub-section to render.
 * @param root0.rootIndex - Zero-based root position for hierarchical numbering.
 * @param root0.subIndex - Zero-based sub-section position for hierarchical numbering.
 * @param root0.isSelected - Whether this section is currently selected.
 * @param root0.linkedBoxIds - Box ids linked to this section.
 * @param root0.sourcesList - All library sources of the thesis.
 * @param root0.onSelect - Selection handler.
 */
export function OutlineSubItem({
  outline,
  rootIndex,
  subIndex,
  isSelected,
  linkedBoxIds,
  sourcesList,
  onSelect,
}: OutlineSubItemProps) {
  const sourcesCount = countLinkedSources(sourcesList, linkedBoxIds);

  return (
    <div
      onClick={onSelect}
      className={`flex cursor-pointer items-start justify-between rounded-md border p-2.5 text-xs transition-all ${
        isSelected
          ? "border-primary/60 bg-primary/10 text-foreground font-semibold ring-1 ring-primary/20"
          : "border-border/40 bg-card/80 hover:border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start gap-2 min-w-0 flex-1 pr-1">
        <span className="font-mono text-xs font-bold text-primary shrink-0 pt-0.5">
          {rootIndex + 1}.{subIndex + 1}
        </span>
        <span className="font-sans font-medium text-foreground break-words whitespace-normal leading-snug">
          {outline.title}
        </span>
      </div>

      {sourcesCount > 0 && (
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <span className="font-mono text-[10px] text-amber-500">
            {sourcesCount}k
          </span>
        </div>
      )}
    </div>
  );
}
