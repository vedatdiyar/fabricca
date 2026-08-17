"use client";

import { Outline } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, X, Layers, Plus } from "lucide-react";
import { OutlineTreeItem } from "./outline-tree-item";
import { OutlineSubItem } from "./outline-sub-item";

interface OutlineTreeExplorerProps {
  rootCount: number;
  filteredRootOutlines: Outline[];
  getSubOutlines: (parentId: number) => Outline[];
  selectedOutlineId: number | null;
  treeSearchQuery: string;
  sourceCountMap: Record<number, number>;
  cardCountMap: Record<number, number>;
  height?: number;
  onTreeSearchChange: (query: string) => void;
  onSelect: (outlineId: number) => void;
  onAddRoot: () => void;
  onAddSub: (parentId: number) => void;
}

/**
 * Left column outline tree explorer: header, search input and the scrollable
 * root/sub-section list that adapts to the right panel height.
 *
 * @param root0 - Component props.
 * @param root0.rootCount - Total root section count for the header badge.
 * @param root0.filteredRootOutlines - Root sections after search filtering.
 * @param root0.getSubOutlines - Resolves sub-sections for a given root.
 * @param root0.selectedOutlineId - The currently selected section id.
 * @param root0.treeSearchQuery - The current tree search query.
 * @param root0.sourceCountMap - Distinct linked source counts per section.
 * @param root0.cardCountMap - Pinned citation card counts per section.
 * @param root0.height - Optional explicit height synced from the right panel.
 * @param root0.onTreeSearchChange - Search query mutator.
 * @param root0.onSelect - Section selection handler.
 * @param root0.onAddRoot - Root section creation handler.
 * @param root0.onAddSub - Sub-section creation handler.
 */
export function OutlineTreeExplorer({
  rootCount,
  filteredRootOutlines,
  getSubOutlines,
  selectedOutlineId,
  treeSearchQuery,
  sourceCountMap,
  cardCountMap,
  height,
  onTreeSearchChange,
  onSelect,
  onAddRoot,
  onAddSub,
}: OutlineTreeExplorerProps) {
  return (
    <div
      className="lg:col-span-4 flex flex-col min-h-0"
      style={height ? { height: `${height}px` } : undefined}
    >
      <Card className="border-border bg-card p-3.5 flex flex-col h-full min-h-0 space-y-3">
        {/* Tree Header & Actions */}
        <div className="flex items-center justify-between px-1 pb-2 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-foreground">
              Bölüm İskeleti
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="secondary"
              className="font-mono text-[10px] px-2 py-0.5"
            >
              {rootCount} Ana Bölüm
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onAddRoot}
              title="Yeni Ana Bölüm Ekle"
              aria-label="Yeni Ana Bölüm Ekle"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tree Search Input */}
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={treeSearchQuery}
            onChange={(e) => onTreeSearchChange(e.target.value)}
            placeholder="Bölüm veya başlık ara..."
            className="h-8 pl-8 pr-7 text-xs bg-background/50 border-border/60"
          />
          {treeSearchQuery && (
            <button
              type="button"
              onClick={() => onTreeSearchChange("")}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tree List (Adapts dynamically to right panel height) */}
        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
          {filteredRootOutlines.length > 0 ? (
            filteredRootOutlines.map((root, idx) => {
              const subItems = getSubOutlines(root.id);

              return (
                <div key={root.id} className="space-y-1.5">
                  <OutlineTreeItem
                    outline={root}
                    index={idx}
                    isSelected={selectedOutlineId === root.id}
                    sourcesCount={sourceCountMap[root.id] ?? 0}
                    cardsCount={cardCountMap[root.id] ?? 0}
                    onSelect={() => onSelect(root.id)}
                    onAddSub={() => onAddSub(root.id)}
                  />

                  {/* Sub-sections tree nesting */}
                  {subItems.length > 0 && (
                    <div className="ml-4 space-y-1 border-l-2 border-primary/25 pl-2.5 pt-0.5">
                      {subItems.map((sub, subIdx) => (
                        <OutlineSubItem
                          key={sub.id}
                          outline={sub}
                          rootIndex={idx}
                          subIndex={subIdx}
                          isSelected={selectedOutlineId === sub.id}
                          sourcesCount={sourceCountMap[sub.id] ?? 0}
                          cardsCount={cardCountMap[sub.id] ?? 0}
                          onSelect={() => onSelect(sub.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Arama kriterinize uygun bölüm bulunamadı.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
