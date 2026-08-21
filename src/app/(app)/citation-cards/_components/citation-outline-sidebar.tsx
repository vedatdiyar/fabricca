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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CitationCardItem, OutlineItem } from "../_lib/types";

interface CitationOutlineSidebarProps {
  outlines: OutlineItem[];
  cards: CitationCardItem[];
  selectedOutlineId: number | null;
  unassignedOnly: boolean;
  onSelectAll: () => void;
  onSelectUnassigned: () => void;
  onSelectOutline: (outlineId: number) => void;
}

/**
 * Thesis Outline Navigation Sidebar (Sol Tez İskeleti Gezgini).
 * Provides a persistent, structured chapter tree with real-time citation counts.
 *
 * @param props - Component props.
 * @returns Rendered outline sidebar component markup.
 */
export function CitationOutlineSidebar({
  outlines,
  cards,
  selectedOutlineId,
  unassignedOnly,
  onSelectAll,
  onSelectUnassigned,
  onSelectOutline,
}: CitationOutlineSidebarProps) {
  // Collapsed main chapters state
  const [collapsedChapters, setCollapsedChapters] = useState<
    Record<number, boolean>
  >({});

  const toggleChapter = (chapterId: number, e: React.MouseEvent) => {
    e.stopPropagation();
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

  // 1. Separate main chapters and subsections
  const mainChapters = outlines
    .filter((o) => o.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const subSections = outlines.filter((o) => o.parentId !== null);

  const isAllSelected = selectedOutlineId === null && !unassignedOnly;

  return (
    <Card className="w-full lg:w-72 shrink-0 p-3 rounded-md border-border bg-card/60 flex flex-col gap-2 select-none">
      {/* Sidebar Header */}
      <div className="px-2 py-1.5 flex items-center justify-between border-b border-border/50 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FolderTree className="h-3.5 w-3.5 text-primary" />
          Tez İskeleti
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {totalCount} Fiş
        </span>
      </div>

      {/* Top Global Navigation Links */}
      <div className="space-y-1">
        {/* Tüm Fişler Link */}
        <button
          type="button"
          onClick={onSelectAll}
          className={cn(
            "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer text-left font-medium",
            isAllSelected
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-foreground hover:bg-muted/60",
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Tüm Fişler</span>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-[10px] px-1.5 py-0 shrink-0",
              isAllSelected
                ? "bg-primary-foreground/20 text-primary-foreground border-transparent"
                : "bg-muted text-muted-foreground border-border",
            )}
          >
            {totalCount}
          </Badge>
        </button>

        {/* Atanmamış Fişler Link */}
        <button
          type="button"
          onClick={onSelectUnassigned}
          className={cn(
            "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer text-left font-medium",
            unassignedOnly
              ? "bg-amber-500 text-white font-semibold shadow-xs"
              : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10",
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Atanmamış Fişler</span>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-[10px] px-1.5 py-0 shrink-0",
              unassignedOnly
                ? "bg-white/20 text-white border-transparent"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
            )}
          >
            {unassignedCount}
          </Badge>
        </button>
      </div>

      <div className="border-t border-border/40 my-1" />

      {/* Chapters & Subsections Tree */}
      <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
        {mainChapters.map((chapter) => {
          const isCollapsed = Boolean(collapsedChapters[chapter.id]);
          const chapterChildren = subSections
            .filter((sub) => sub.parentId === chapter.id)
            .sort((a, b) => a.sortOrder - b.sortOrder);

          // Calculate total cards in this chapter + its children
          const directCount = outlineCardCountMap.get(chapter.id) ?? 0;
          const childrenCount = chapterChildren.reduce(
            (sum, child) => sum + (outlineCardCountMap.get(child.id) ?? 0),
            0,
          );
          const chapterTotalCount = directCount + childrenCount;

          const isChapterSelected =
            selectedOutlineId === chapter.id && !unassignedOnly;

          return (
            <div key={chapter.id} className="space-y-0.5">
              {/* Main Chapter Item */}
              <div
                onClick={() => onSelectOutline(chapter.id)}
                className={cn(
                  "group flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors cursor-pointer text-left select-none",
                  isChapterSelected
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-foreground hover:bg-muted/60",
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {chapterChildren.length > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => toggleChapter(chapter.id, e)}
                      className={cn(
                        "p-0.5 rounded hover:bg-muted/80 text-muted-foreground",
                        isChapterSelected &&
                          "hover:bg-primary-foreground/20 text-primary-foreground",
                      )}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      )}
                    </button>
                  ) : (
                    <span className="w-4" />
                  )}

                  {isChapterSelected ? (
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}

                  <span className="truncate font-medium text-xs">
                    {chapter.title}
                  </span>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono text-[10px] px-1 py-0 shrink-0 ml-1",
                    isChapterSelected
                      ? "bg-primary-foreground/20 text-primary-foreground border-transparent"
                      : chapterTotalCount > 0
                        ? "bg-primary/10 text-primary border-primary/20 font-semibold"
                        : "bg-transparent text-muted-foreground/60 border-border/40",
                  )}
                >
                  {chapterTotalCount}
                </Badge>
              </div>

              {/* Subsections List */}
              {!isCollapsed && chapterChildren.length > 0 && (
                <div className="pl-4 space-y-0.5 border-l border-border/50 ml-3">
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
                          "w-full flex items-center justify-between px-2 py-1 rounded text-[11px] transition-colors cursor-pointer text-left select-none",
                          isSubSelected
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        )}
                      >
                        <span className="truncate flex-1 pr-1">
                          {sub.title}
                        </span>

                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono text-[9px] px-1 py-0 shrink-0",
                            isSubSelected
                              ? "bg-primary-foreground/20 text-primary-foreground border-transparent"
                              : subCount > 0
                                ? "bg-primary/10 text-primary border-primary/20 font-semibold"
                                : "bg-transparent text-muted-foreground/40 border-transparent",
                          )}
                        >
                          {subCount}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
