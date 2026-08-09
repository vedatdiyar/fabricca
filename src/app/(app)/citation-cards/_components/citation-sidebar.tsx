"use client";

import { useMemo, useState } from "react";
import { Layers, FileText, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  getBoxTypeBadgeConfig,
  BOX_TYPE_SHORT_LABELS,
  compareBoxTypes,
  type ThesisBoxType,
} from "@/lib/box-constants";
import { cn } from "@/lib/utils";
import type { CitationCardItem, BoxItem, SourceItem } from "../_lib/types";

/** Tab structure for box type filters. */
const BOX_TYPE_TABS: { id: ThesisBoxType | "ALL"; label: string }[] = [
  { id: "ALL", label: "Tümü" },
  { id: "SUBJECT_PROBLEM", label: BOX_TYPE_SHORT_LABELS.SUBJECT_PROBLEM },
  {
    id: "THEORETICAL_FRAMEWORK",
    label: BOX_TYPE_SHORT_LABELS.THEORETICAL_FRAMEWORK,
  },
  { id: "METHODOLOGY", label: BOX_TYPE_SHORT_LABELS.METHODOLOGY },
  { id: "PRIMARY_MATERIAL", label: BOX_TYPE_SHORT_LABELS.PRIMARY_MATERIAL },
  { id: "RELATED_THESES", label: BOX_TYPE_SHORT_LABELS.RELATED_THESES },
];

/** Props for CitationSidebar component. */
export interface CitationSidebarProps {
  boxes: BoxItem[];
  sources: SourceItem[];
  cards: CitationCardItem[];
  selectedBoxId: number | null;
  selectedSourceId: number | null;
  onSelectBox: (boxId: number | null) => void;
  onSelectSource: (sourceId: number | null) => void;
}

/**
 * Sidebar component displaying topic boxes and linked sources with search and box-type tabs.
 * Features sticky positioning, compact cards, and instant filtering.
 *
 * @param props - Sidebar props with boxes, sources, and selection handlers.
 * @returns Sidebar markup.
 */
export function CitationSidebar(props: CitationSidebarProps) {
  const {
    boxes,
    sources,
    cards,
    selectedBoxId,
    selectedSourceId,
    onSelectBox,
    onSelectSource,
  } = props;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ThesisBoxType | "ALL">("ALL");

  // Filter boxes based on active tab and search query, then sort into the
  // canonical type order (SP → TF → METHOD → PM → RELATED_THESES) so that
  // boxes of the same type are grouped one below the other.
  const filteredBoxes = useMemo(() => {
    return boxes
      .filter((box) => {
        const matchesTab = activeTab === "ALL" || box.boxType === activeTab;
        const matchesQuery =
          searchQuery.trim() === "" ||
          box.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesQuery;
      })
      .sort((a, b) => compareBoxTypes(a.boxType, b.boxType));
  }, [boxes, activeTab, searchQuery]);

  // Filter sources belonging to the selected box if a box is selected, and search query
  const filteredSources = useMemo(() => {
    const scopeSources = selectedBoxId
      ? sources.filter((s) => s.boxId === selectedBoxId)
      : sources;

    if (!searchQuery.trim()) return scopeSources;

    return scopeSources.filter((s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [sources, selectedBoxId, searchQuery]);

  const totalCards = cards.length;
  const isFilterActive =
    selectedBoxId !== null ||
    selectedSourceId !== null ||
    activeTab !== "ALL" ||
    searchQuery.trim() !== "";

  const handleResetFilters = () => {
    onSelectBox(null);
    onSelectSource(null);
    setActiveTab("ALL");
    setSearchQuery("");
  };

  return (
    <aside className="w-full lg:w-96 shrink-0 flex flex-col rounded-md border border-border bg-card p-3 lg:sticky lg:top-[92px] lg:h-[calc(100vh-7rem)] lg:overflow-hidden min-w-0 space-y-3">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground truncate">
            Alıntı Fişleri
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className="text-xs font-medium text-muted-foreground border-border"
          >
            {totalCards}
          </Badge>
          {isFilterActive && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetFilters}
              title="Filtreleri Temizle"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full shrink-0">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Kutu veya kaynak ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 text-xs h-8 bg-background border-border"
        />
      </div>

      {/* Box Type Tabs Grid */}
      <div className="grid grid-cols-6 gap-1 rounded-md bg-muted p-1 border border-border/40 shrink-0">
        {BOX_TYPE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full text-center py-1 text-[10px] font-medium rounded transition-all truncate px-1",
                isActive
                  ? "bg-background text-foreground font-semibold border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/20",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable Items Area */}
      <ScrollArea className="flex-1 min-h-0 pr-1">
        <div className="space-y-3 min-w-0">
          {/* List of Topic Boxes */}
          <div className="space-y-1.5 min-w-0">
            <div className="px-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Tez Konu Kutuları</span>
            </div>

            {filteredBoxes.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground italic bg-muted/30 rounded-md border border-border/40">
                Kutu bulunamadı.
              </div>
            ) : (
              filteredBoxes.map((box) => {
                const isSelected = selectedBoxId === box.id;
                const boxConfig = getBoxTypeBadgeConfig(box.boxType);
                const boxCardCount = cards.filter(
                  (c) => c.boxId === box.id,
                ).length;

                return (
                  <Card
                    key={box.id}
                    onClick={() => {
                      onSelectBox(isSelected ? null : box.id);
                      onSelectSource(null);
                    }}
                    className={cn(
                      "cursor-pointer transition-all border p-2 text-left hover:border-primary/20",
                      isSelected
                        ? "bg-accent/20 border-primary/20"
                        : "bg-background border-border hover:bg-accent/20",
                    )}
                  >
                    <CardContent className="p-0 space-y-1">
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full shrink-0",
                              boxConfig.dotClassName,
                            )}
                          />
                          <span className="text-[10px] font-medium text-muted-foreground truncate">
                            {boxConfig.label}
                          </span>
                        </div>
                        <span className="inline-flex items-center rounded-md border border-border bg-muted/20 px-2 py-0 text-[10px] font-mono text-muted-foreground shrink-0">
                          {boxCardCount}
                        </span>
                      </div>
                      <div
                        className="text-xs font-medium text-foreground truncate min-w-0"
                        title={box.title}
                      >
                        {box.title}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <Separator className="bg-border/40" />

          {/* Sources Section */}
          <div className="space-y-1.5 min-w-0 pb-2">
            <div className="px-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Kaynaklar</span>
              {selectedBoxId ? (
                <span className="text-[10px] font-normal text-muted-foreground">
                  (Seçili Kutuya Özel)
                </span>
              ) : (
                <span className="font-mono text-[10px]">
                  ({filteredSources.length})
                </span>
              )}
            </div>

            {filteredSources.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground italic bg-muted/20 rounded-md border border-border/40">
                Kaynak bulunamadı.
              </div>
            ) : (
              filteredSources.map((source) => {
                const isSourceSelected = selectedSourceId === source.id;
                const sourceCardCount = cards.filter(
                  (c) => c.sourceId === source.id,
                ).length;

                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() =>
                      onSelectSource(isSourceSelected ? null : source.id)
                    }
                    className={cn(
                      "w-full text-left p-2 rounded-md text-xs flex items-center justify-between gap-2 transition-all min-w-0 border",
                      isSourceSelected
                        ? "bg-primary/10 text-primary font-medium border-primary/20"
                        : "bg-background border-border text-muted-foreground hover:bg-accent/20 hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span
                        className="truncate block min-w-0"
                        title={source.title}
                      >
                        {source.title}
                      </span>
                    </div>
                    <span className="inline-flex items-center rounded-md border border-border bg-muted/20 px-2 py-0 text-[10px] font-mono text-muted-foreground shrink-0">
                      {sourceCardCount}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
