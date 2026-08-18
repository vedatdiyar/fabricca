"use client";

import { Search, X, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BOX_TYPE_SHORT_LABELS } from "@/lib/box-constants";
import { cn } from "@/lib/utils";
import type { CitationCardItem, BoxItem, SourceItem } from "../_lib/types";
import {
  useCitationSidebarFilters,
  DEFAULT_BOX_TYPE_TAB,
  type BoxTypeTab,
} from "../_hooks/use-citation-sidebar-filters";
import { SidebarBoxList } from "./sidebar-box-list";
import { SidebarSourceList } from "./sidebar-source-list";

/** Tab structure for box type filters. */
const BOX_TYPE_TABS: { id: BoxTypeTab; label: string }[] = [
  { id: "ALL", label: "Tümü" },
  { id: "SUBJECT_PROBLEM", label: BOX_TYPE_SHORT_LABELS.SUBJECT_PROBLEM },
  {
    id: "THEORETICAL_FRAMEWORK",
    label: BOX_TYPE_SHORT_LABELS.THEORETICAL_FRAMEWORK,
  },
  { id: "METHODOLOGY", label: BOX_TYPE_SHORT_LABELS.METHODOLOGY },
  { id: "PRIMARY_MATERIAL", label: BOX_TYPE_SHORT_LABELS.PRIMARY_MATERIAL },
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
 * Sidebar component displaying topic boxes and linked sources with search and
 * box-type tabs. Features sticky positioning, compact cards, and instant
 * filtering.
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

  const {
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    filteredBoxes,
    filteredSources,
    resetSidebarFilters,
  } = useCitationSidebarFilters(boxes, sources, selectedBoxId);

  const totalCards = cards.length;
  const isFilterActive =
    selectedBoxId !== null ||
    selectedSourceId !== null ||
    activeTab !== DEFAULT_BOX_TYPE_TAB ||
    searchQuery.trim() !== "";

  const handleResetFilters = () => {
    onSelectBox(null);
    onSelectSource(null);
    resetSidebarFilters();
  };

  return (
    <Card className="w-full lg:w-96 shrink-0 flex flex-col rounded-md p-4 lg:sticky lg:top-[92px] lg:h-[calc(100vh-7rem)] lg:overflow-hidden min-w-0 border-border">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground">
              Kutu & Kaynaklar
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Tez konu kutusu ve kaynak filtresi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-semibold text-muted-foreground border-border"
          >
            {totalCards} Fiş
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
      <div className="relative w-full shrink-0 my-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Kutu veya kaynak ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 pr-8 text-xs h-8 bg-background border-border"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Box Type Filter Tabs */}
      <div className="grid grid-cols-6 gap-1 mb-3 shrink-0 rounded-md bg-muted/40 p-1 border border-border/40">
        {BOX_TYPE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full text-center py-1 text-[10px] font-medium rounded transition-all truncate px-0.5 cursor-pointer select-none",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
              )}
              title={tab.label}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable Items Area */}
      <ScrollArea className="flex-1 min-h-0 pr-1.5 -mr-1.5">
        <div className="space-y-4 min-w-0 pr-1">
          <SidebarBoxList
            boxes={filteredBoxes}
            cards={cards}
            selectedBoxId={selectedBoxId}
            onSelectBox={onSelectBox}
            onSelectSource={onSelectSource}
          />

          <Separator className="bg-border/60" />

          <SidebarSourceList
            sources={filteredSources}
            cards={cards}
            selectedBoxId={selectedBoxId}
            selectedSourceId={selectedSourceId}
            onSelectSource={onSelectSource}
          />
        </div>
      </ScrollArea>
    </Card>
  );
}
