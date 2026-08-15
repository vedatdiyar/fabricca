"use client";

import { Outline, Source } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, FileText } from "lucide-react";
import {
  countLinkedSources,
  isIntroOrConclusion,
} from "../../utils/outline-helpers";

interface OutlineTreeItemProps {
  outline: Outline;
  index: number;
  isSelected: boolean;
  linkedBoxIds: number[];
  sourcesList: Source[];
  onSelect: () => void;
  onAddSub: () => void;
}

/**
 * Root chapter card in the outline tree explorer.
 *
 * @param root0 - Component props.
 * @param root0.outline - The root section to render.
 * @param root0.index - Zero-based position within the root list.
 * @param root0.isSelected - Whether this section is currently selected.
 * @param root0.linkedBoxIds - Box ids linked to this section.
 * @param root0.sourcesList - All library sources of the thesis.
 * @param root0.onSelect - Selection handler.
 * @param root0.onAddSub - Sub-section creation handler.
 */
export function OutlineTreeItem({
  outline,
  index,
  isSelected,
  linkedBoxIds,
  sourcesList,
  onSelect,
  onAddSub,
}: OutlineTreeItemProps) {
  const sourcesCount = countLinkedSources(sourcesList, linkedBoxIds);

  return (
    <div
      onClick={onSelect}
      className={`group relative flex cursor-pointer items-start justify-between rounded-md border p-3 transition-all ${
        isSelected
          ? "border-primary bg-primary/10 text-foreground font-semibold ring-1 ring-primary/20"
          : "border-border/60 bg-card hover:border-border text-foreground hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1 pr-1">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary border border-primary/20 text-xs font-bold font-mono">
          {index + 1}
        </span>
        <div className="space-y-1 min-w-0 flex-1">
          <span className="font-serif text-sm font-semibold leading-snug block break-words whitespace-normal">
            {outline.title}
          </span>

          {/* Badges metadata row */}
          {sourcesCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <FileText className="h-3 w-3 shrink-0 text-amber-500" />
                {sourcesCount} kaynak
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action icons on root item */}
      <div className="flex items-center gap-1 shrink-0 pt-0.5">
        {!isIntroOrConclusion(outline.title) && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onAddSub();
            }}
            title="Alt Bölüm Ekle"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
        <ChevronRight
          className={`h-4 w-4 transition-transform ${
            isSelected
              ? "text-primary translate-x-0.5"
              : "text-muted-foreground/60"
          }`}
        />
      </div>
    </div>
  );
}
