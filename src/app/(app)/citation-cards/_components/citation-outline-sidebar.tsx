"use client";

import { useState } from "react";
import {
  Layers,
  AlertCircle,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Boxes,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { cn } from "@/lib/utils";
import type { BoxItem, CitationCardItem, OutlineItem } from "../_lib/types";

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
              unassignedCount > 0 ? "text-amber-500 font-semibold" : "text-muted-foreground",
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
          {mainChapters.map((chapter) => {
            const isCollapsed = Boolean(collapsedChapters[chapter.id]);
            const chapterChildren = subSections
              .filter((sub) => sub.parentId === chapter.id)
              .sort((a, b) => a.sortOrder - b.sortOrder);

            const hasChildren = chapterChildren.length > 0;
            const directCount = outlineCardCountMap.get(chapter.id) ?? 0;
            const childrenCount = chapterChildren.reduce(
              (sum, child) => sum + (outlineCardCountMap.get(child.id) ?? 0),
              0,
            );
            const chapterTotalCount = hasChildren ? childrenCount : directCount;

            const isChapterSelected =
              !hasChildren && selectedOutlineId === chapter.id && !unassignedOnly;

            const handleChapterClick = () => {
              if (hasChildren) {
                toggleChapter(chapter.id);
              } else {
                onSelectOutline(chapter.id);
              }
            };

            return (
              <div key={chapter.id} className="space-y-0.5">
                {/* Main Chapter Item: Pure Folder Toggle if it has children; Selectable leaf node if not */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleChapterClick}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleChapterClick();
                    }
                  }}
                  className={cn(
                    "group flex items-start justify-between px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-left select-none gap-1.5",
                    isChapterSelected
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-start gap-1.5 min-w-0 flex-1">
                    {hasChildren ? (
                      <span className="p-0.5 text-muted-foreground shrink-0 mt-0.5">
                        {isCollapsed ? (
                          <ChevronRight className="size-3 shrink-0" />
                        ) : (
                          <ChevronDown className="size-3 shrink-0" />
                        )}
                      </span>
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}

                    {hasChildren ? (
                      isCollapsed ? (
                        <Folder className="size-3.5 text-primary/80 shrink-0 mt-0.5" />
                      ) : (
                        <FolderOpen className="size-3.5 text-primary shrink-0 mt-0.5" />
                      )
                    ) : (
                      <Folder className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    )}

                    <span
                      className={cn(
                        "text-xs leading-snug break-words whitespace-normal flex-1",
                        hasChildren ? "font-semibold text-foreground/90" : "font-medium",
                      )}
                    >
                      {chapter.title}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "font-mono text-[10px] shrink-0 ml-1 mt-0.5",
                      isChapterSelected
                        ? "text-primary font-bold"
                        : chapterTotalCount > 0
                          ? "text-muted-foreground font-medium"
                          : "text-muted-foreground/40",
                    )}
                  >
                    {chapterTotalCount}
                  </span>
                </div>

                {/* Subsections List */}
                {!isCollapsed && chapterChildren.length > 0 && (
                  <div className="pl-3.5 space-y-0.5 border-l border-border/40 ml-3">
                    {chapterChildren.map((sub) => {
                      const subCount = outlineCardCountMap.get(sub.id) ?? 0;
                      const isSubSelected =
                        selectedOutlineId === sub.id && !unassignedOnly;

                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onSelectOutline(sub.id)}
                          className={cn(
                            "w-full flex items-start justify-between px-2 py-1 rounded text-[11px] transition-colors cursor-pointer text-left select-none gap-1.5",
                            isSubSelected
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                          )}
                        >
                          <span className="flex-1 pr-1 leading-snug break-words whitespace-normal text-left">
                            {sub.title}
                          </span>

                          <span
                            className={cn(
                              "font-mono text-[9px] shrink-0 mt-0.5",
                              isSubSelected
                                ? "text-primary font-bold"
                                : subCount > 0
                                  ? "text-muted-foreground font-medium"
                                  : "text-muted-foreground/30",
                            )}
                          >
                            {subCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Tab Content: Topic Boxes (Konu Kutuları) */}
      {activeTab === "boxes" && boxes.length > 0 && onSelectBox && (
        <div className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-1">
          {boxes.map((box) => {
            const boxConfig = getBoxTypeBadgeConfig(box.boxType);
            const isBoxSelected = selectedBoxId === box.id;
            const boxCardsCount = cards.filter(
              (c) => c.boxId === box.id,
            ).length;

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
      )}
    </Card>
  );
}
