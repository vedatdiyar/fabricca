"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CitationCard } from "./citation-card";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { cn } from "@/lib/utils";
import type {
  BoxItem,
  CitationCardItem,
  CitationGroupBy,
  OutlineItem,
} from "../_lib/types";

interface CitationSectionGroupProps {
  groupBy: CitationGroupBy;
  cards: CitationCardItem[];
  outlines: OutlineItem[];
  boxes: BoxItem[];
  selectedCardId: number | null;
  onView: (card: CitationCardItem) => void;
  onEdit: (card: CitationCardItem) => void;
  onDelete: (id: number) => void;
  onMoveBox: (cardId: number, targetBoxId: number) => void;
}

/**
 * Grouped Section Container for Citation Cards.
 * Supports clean Gallery Grid, Active Outline Chapters, or Thematic Box groups.
 * Only renders active sections with cards, eliminating empty accordions clutter.
 *
 * @param props - Component props.
 * @returns Rendered grouped cards markup.
 */
export function CitationSectionGroup({
  groupBy,
  cards,
  outlines,
  boxes,
  selectedCardId,
  onView,
  onEdit,
  onDelete,
  onMoveBox,
}: CitationSectionGroupProps) {
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 1. GALLERY / FLAT GRID VIEW (Default & Cleanest)
  if (groupBy === "NONE") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {cards.map((card) => (
          <CitationCard
            key={card.id}
            card={card}
            availableBoxes={boxes}
            isSelected={selectedCardId === card.id}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onMoveBox={onMoveBox}
          />
        ))}
      </div>
    );
  }

  // 2. GROUP BY THEMATIC BOXES (Only boxes with cards)
  if (groupBy === "BOX") {
    const activeBoxes = boxes.filter((box) =>
      cards.some((c) => c.boxId === box.id),
    );

    if (activeBoxes.length === 0) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {cards.map((card) => (
            <CitationCard
              key={card.id}
              card={card}
              availableBoxes={boxes}
              isSelected={selectedCardId === card.id}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onMoveBox={onMoveBox}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {activeBoxes.map((box) => {
          const boxCards = cards.filter((c) => c.boxId === box.id);
          const isCollapsed = Boolean(collapsedSections[`box-${box.id}`]);
          const boxConfig = getBoxTypeBadgeConfig(box.boxType);

          return (
            <div key={box.id} className="space-y-2.5">
              {/* Section Header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleSection(`box-${box.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleSection(`box-${box.id}`);
                  }
                }}
                className="flex items-center justify-between p-2.5 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer border border-border/60 select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      boxConfig.dotClassName,
                    )}
                  />
                  <h3 className="font-serif text-xs font-semibold text-foreground truncate">
                    {box.title}
                  </h3>
                </div>

                <Badge
                  variant="outline"
                  className="font-mono text-[10px] text-foreground bg-background border-border shrink-0"
                >
                  {boxCards.length} Fiş
                </Badge>
              </div>

              {/* Cards Grid */}
              {!isCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pl-2 sm:pl-3 border-l-2 border-border/40">
                  {boxCards.map((card) => (
                    <CitationCard
                      key={card.id}
                      card={card}
                      availableBoxes={boxes}
                      isSelected={selectedCardId === card.id}
                      onView={onView}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onMoveBox={onMoveBox}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // 3. GROUP BY OUTLINE SECTIONS (Only sections that contain cards)
  const unassignedCards = cards.filter((c) => c.outlineIds.length === 0);
  const activeOutlines = outlines.filter((outline) =>
    cards.some((c) => c.outlineIds.includes(outline.id)),
  );
  const isUnassignedCollapsed = Boolean(collapsedSections["unassigned"]);

  return (
    <div className="space-y-5">
      {/* Unassigned Cards Staging Section (if any unassigned cards exist) */}
      {unassignedCards.length > 0 && (
        <div className="space-y-2.5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleSection("unassigned")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleSection("unassigned");
              }
            }}
            className="flex items-center justify-between p-2.5 rounded-md bg-amber-500/10 hover:bg-amber-500/15 transition-colors cursor-pointer border border-amber-500/20 select-none"
          >
            <div className="flex items-center gap-2 min-w-0 text-amber-600 dark:text-amber-400">
              {isUnassignedCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              )}
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <h3 className="font-serif text-xs font-semibold tracking-tight truncate">
                ⚠️ Henüz Bir Tez Bölümüne Atanmamış Fişler Havuzu
              </h3>
            </div>

            <Badge
              variant="outline"
              className="font-mono text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-background shrink-0"
            >
              {unassignedCards.length} Fiş
            </Badge>
          </div>

          {!isUnassignedCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pl-2 sm:pl-3 border-l-2 border-amber-500/30">
              {unassignedCards.map((card) => (
                <CitationCard
                  key={card.id}
                  card={card}
                  availableBoxes={boxes}
                  isSelected={selectedCardId === card.id}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMoveBox={onMoveBox}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Outline Chapter Sections (Only sections with cards) */}
      {activeOutlines.map((outline) => {
        const isChild = outline.parentId !== null;
        const sectionCards = cards.filter((c) =>
          c.outlineIds.includes(outline.id),
        );
        const isCollapsed = Boolean(collapsedSections[`outline-${outline.id}`]);

        return (
          <div key={outline.id} className="space-y-2.5">
            {/* Section Header */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleSection(`outline-${outline.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSection(`outline-${outline.id}`);
                }
              }}
              className={cn(
                "flex items-center justify-between p-2.5 rounded-md transition-colors cursor-pointer border select-none",
                isChild
                  ? "bg-muted/20 hover:bg-muted/40 border-border/60"
                  : "bg-muted/40 hover:bg-muted/60 border-border",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                {isChild ? (
                  <FolderTree className="h-3.5 w-3.5 text-primary shrink-0" />
                ) : (
                  <FolderOpen className="h-3.5 w-3.5 text-foreground shrink-0" />
                )}
                <h3 className="font-serif text-xs font-semibold text-foreground truncate">
                  {outline.title}
                </h3>
              </div>

              <Badge
                variant="outline"
                className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold shrink-0"
              >
                {sectionCards.length} Fiş
              </Badge>
            </div>

            {/* Cards Grid */}
            {!isCollapsed && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pl-2 sm:pl-3 border-l-2 border-border/40">
                {sectionCards.map((card) => (
                  <CitationCard
                    key={card.id}
                    card={card}
                    availableBoxes={boxes}
                    isSelected={selectedCardId === card.id}
                    onView={onView}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMoveBox={onMoveBox}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
