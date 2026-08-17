"use client";

import { useMemo, useState } from "react";
import { Layers, BookOpen, Search, X, Check, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
interface SidebarBoxListProps {
  boxes: BoxItem[];
  cards: CitationCardItem[];
  selectedBoxId: number | null;
  onSelectBox: (id: number | null) => void;
  onSelectSource: (id: number | null) => void;
}

function SidebarBoxList({
  boxes,
  cards,
  selectedBoxId,
  onSelectBox,
  onSelectSource,
}: SidebarBoxListProps) {
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="px-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-primary" />
          Tez Konu Kutuları
        </span>
        <span className="font-mono text-[10px]">({boxes.length})</span>
      </div>

      {boxes.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground italic bg-muted/20 rounded-md border border-border/40">
          Aramaya uygun kutu bulunamadı.
        </div>
      ) : (
        <div className="space-y-1">
          {boxes.map((box) => {
            const isSelected = selectedBoxId === box.id;
            const boxConfig = getBoxTypeBadgeConfig(box.boxType);
            const boxCardCount = cards.filter((c) => c.boxId === box.id).length;

            return (
              <button
                key={box.id}
                type="button"
                onClick={() => {
                  onSelectBox(isSelected ? null : box.id);
                  onSelectSource(null);
                }}
                className={cn(
                  "w-full text-left p-2 rounded-md transition-all border flex flex-col gap-1 cursor-pointer select-none",
                  isSelected
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-card/50 border-border/60 hover:border-border hover:bg-accent/20 text-foreground",
                )}
              >
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        boxConfig.dotClassName,
                      )}
                    />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                      {boxConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && (
                      <Check className="h-3 w-3 text-primary shrink-0" />
                    )}
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-muted text-foreground border border-border/40 shrink-0">
                      {boxCardCount}
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    "text-xs font-medium truncate min-w-0",
                    isSelected
                      ? "text-primary font-semibold"
                      : "text-foreground",
                  )}
                  title={box.title}
                >
                  {box.title}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SidebarSourceListProps {
  sources: SourceItem[];
  cards: CitationCardItem[];
  selectedBoxId: number | null;
  selectedSourceId: number | null;
  onSelectSource: (id: number | null) => void;
}

function SidebarSourceList({
  sources,
  cards,
  selectedBoxId,
  selectedSourceId,
  onSelectSource,
}: SidebarSourceListProps) {
  return (
    <div className="space-y-1.5 min-w-0 pb-2">
      <div className="px-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-3 w-3 text-info" />
          Kaynaklar
        </span>
        {selectedBoxId ? (
          <span className="text-[10px] text-primary font-medium">
            (Kutuya Bağlı: {sources.length})
          </span>
        ) : (
          <span className="font-mono text-[10px]">({sources.length})</span>
        )}
      </div>

      {sources.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground italic bg-muted/20 rounded-md border border-border/40">
          Kaynak bulunamadı.
        </div>
      ) : (
        <div className="space-y-1">
          {sources.map((source) => {
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
                  "w-full text-left p-2 rounded-md transition-all border flex items-center justify-between gap-2 cursor-pointer select-none",
                  isSourceSelected
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "bg-card/50 border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/20 hover:border-border",
                )}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-xs truncate block font-medium",
                      isSourceSelected
                        ? "text-primary font-semibold"
                        : "text-foreground",
                    )}
                    title={source.title}
                  >
                    {source.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {source.authors[0] ?? "Bilinmeyen Yazar"} (
                    {source.publicationYear})
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isSourceSelected && (
                    <Check className="h-3 w-3 text-primary shrink-0" />
                  )}
                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-muted text-foreground border border-border/40 shrink-0">
                    {sourceCardCount}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

  const filteredSources = useMemo(() => {
    const scopeSources = selectedBoxId
      ? sources.filter((s) => s.boxId === selectedBoxId)
      : sources;

    if (!searchQuery.trim()) return scopeSources;

    return scopeSources.filter(
      (s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.authors.some((a) =>
          a.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
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
