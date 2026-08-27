"use client";

import { useState } from "react";
import { Layers, AlertCircle, FolderTree, Boxes } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BoxItem, CitationCardItem, OutlineItem } from "../_lib/types";
import { CitationChapterTreeItem } from "./citation-chapter-tree-item";
import { CitationBoxesList } from "./citation-boxes-list";

interface CitationOutlineSidebarProps {
  outlines: OutlineItem[];
  cards: CitationCardItem[];
  boxes?: BoxItem[];
  selectedOutlineId: number | null;
  selectedBoxId?: number | null;
  unassignedOnly: boolean;
  onSelectAll: () => void;
  onSelectUnassigned: () => void;
  onSelectOutline: (outlineId: number) => void;
  onSelectBox?: (boxId: number | null) => void;
}

/**
 * Thesis Outline & Topic Navigator Sidebar.
 * Clean, structured hierarchical tree for thesis chapters and topic boxes.
 *
 * @param props - Component props.
 * @returns Rendered outline sidebar markup.
 */
export function CitationOutlineSidebar({
  outlines,
  cards,
  boxes = [],
  selectedOutlineId,
  selectedBoxId = null,
  unassignedOnly,
  onSelectAll,
  onSelectUnassigned,
  onSelectOutline,
  onSelectBox,
}: CitationOutlineSidebarProps) {
  const [activeTab, setActiveTab] = useState<"outline" | "boxes">("outline");
  const [collapsedChapters, setCollapsedChapters] = useState<
    Record<number, boolean>
  >({});

  const toggleChapter = (chapterId: number) => {
    setCollapsedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const totalCount = cards.length;
  const unassignedCount = cards.filter((c) => c.outlineIds.length === 0).length;

  // Map each outline section ID to the number of cards assigned to it
  const outlineCardCountMap = new Map<number, number>();
  for (const card of cards) {
    for (const oid of card.outlineIds) {
      outlineCardCountMap.set(oid, (outlineCardCountMap.get(oid) ?? 0) + 1);
    }
  }

  // Separate main chapters and subsections
  const mainChapters = outlines
    .filter((o) => o.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const subSections = outlines.filter((o) => o.parentId !== null);

  const isAllSelected =
    selectedOutlineId === null && selectedBoxId === null && !unassignedOnly;

  return (
    <Card className="w-full lg:h-[calc(100vh-7.5rem)] p-3.5 rounded-xl border-border/50 bg-card/60 flex flex-col gap-3 select-none shadow-xs">
      {/* 1. Global View Switchers (Tüm Fişler / Atanmamış) */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-muted/40 border border-border/30 shrink-0">
        <button
          type="button"
          onClick={onSelectAll}
          className={cn(
            "flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer text-left",
            isAllSelected
              ? "bg-background text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Layers className="size-3.5 shrink-0 text-primary/80" />
            <span className="truncate">Tümü</span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground ml-1">
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={onSelectUnassigned}
          className={cn(
            "flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer text-left",
            unassignedOnly
              ? "bg-amber-500/15 text-amber-500 shadow-xs font-semibold"
              : unassignedCount > 0
                ? "text-amber-500/90 hover:bg-amber-500/10"
                : "text-muted-foreground hover:text-foreground",
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="size-3.5 shrink-0" />
            <span className="truncate">Atanmamış</span>
          </div>
          <span
            className={cn(
              "font-mono text-[10px] ml-1",
              unassignedCount > 0
                ? "text-amber-500 font-semibold"
                : "text-muted-foreground",
            )}
          >
            {unassignedCount}
          </span>
        </button>
      </div>

      {/* 2. Segmented Mode Switch: Tez İskeleti vs Konu Kutuları */}
      {boxes.length > 0 && onSelectBox && (
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/20 border border-border/30 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("outline")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer",
              activeTab === "outline"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <FolderTree className="size-3.5 text-primary" />
            <span>Tez İskeleti</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("boxes")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer",
              activeTab === "boxes"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Boxes className="size-3.5 text-primary" />
            <span>Konu Kutuları</span>
          </button>
        </div>
      )}

      {/* 3. Tab Content: Tez İskeleti Tree (Takes all available vertical height) */}
      {activeTab === "outline" && (
        <div className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-1">
          {mainChapters.map((chapter) => (
            <CitationChapterTreeItem
              key={chapter.id}
              chapter={chapter}
              subSections={subSections}
              outlineCardCountMap={outlineCardCountMap}
              isCollapsed={Boolean(collapsedChapters[chapter.id])}
              selectedOutlineId={selectedOutlineId}
              unassignedOnly={unassignedOnly}
              onToggleChapter={toggleChapter}
              onSelectOutline={onSelectOutline}
            />
          ))}
        </div>
      )}

      {/* 4. Tab Content: Topic Boxes (Konu Kutuları) */}
      {activeTab === "boxes" && boxes.length > 0 && onSelectBox && (
        <CitationBoxesList
          boxes={boxes}
          cards={cards}
          selectedBoxId={selectedBoxId}
          onSelectBox={onSelectBox}
        />
      )}
    </Card>
  );
}
