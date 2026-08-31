"use client";

import { Folder, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OutlineItem } from "../_lib/types";

export interface CitationChapterTreeItemProps {
  chapter: OutlineItem;
  subSections: OutlineItem[];
  outlineCardCountMap: Map<number, number>;
  isCollapsed: boolean;
  selectedOutlineId: number | null;
  unassignedOnly: boolean;
  onToggleChapter: (id: number) => void;
  onSelectOutline: (id: number) => void;
}

/**
 * Renders an expandable thesis outline chapter tree item with its direct or aggregated citation card counts.
 *
 * @param props - Outline chapter node properties and selection callbacks.
 * @returns Chapter node element.
 */
export function CitationChapterTreeItem({
  chapter,
  subSections,
  outlineCardCountMap,
  isCollapsed,
  selectedOutlineId,
  unassignedOnly,
  onToggleChapter,
  onSelectOutline,
}: CitationChapterTreeItemProps) {
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
      onToggleChapter(chapter.id);
    } else {
      onSelectOutline(chapter.id);
    }
  };

  return (
    <div className="space-y-0.5">
      {/* Main Chapter Item: Folder Toggle if children exist; Selectable node if not */}
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
              <Folder className="size-3.5 text-primary shrink-0 mt-0.5" />
            ) : (
              <FolderOpen className="size-3.5 text-primary shrink-0 mt-0.5" />
            )
          ) : (
            <Folder className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
          )}

          <span
            className={cn(
              "text-xs leading-snug break-words whitespace-normal flex-1",
              hasChildren ? "font-semibold text-foreground" : "font-medium",
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
                : "text-muted-foreground",
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
                        : "text-muted-foreground",
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
}
