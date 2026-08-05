"use client";

import { Folder, Layers, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import type { CitationCardItem, BoxItem, SourceItem } from "../_lib/types";

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
 * Sidebar component displaying topic boxes and linked sources.
 * Features sticky positioning and overflow-protected item truncation.
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

  // Filter sources belonging to the selected box if a box is selected
  const availableSources = selectedBoxId
    ? sources.filter((s) => s.boxId === selectedBoxId)
    : sources;

  const totalCards = cards.length;

  return (
    <aside className="w-full lg:w-72 shrink-0 flex flex-col rounded-md border border-border bg-card/40 backdrop-blur-md lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-7rem)] min-w-0">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-border/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 font-semibold text-xs text-foreground uppercase tracking-wider min-w-0">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate">Alıntı Fişleri</span>
        </div>
        {(selectedBoxId !== null || selectedSourceId !== null) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelectBox(null);
              onSelectSource(null);
            }}
            className="h-7 text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            Filtreyi Temizle
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0 p-3">
        <div className="space-y-4 min-w-0">
          {/* All Boxes Option */}
          <button
            type="button"
            onClick={() => {
              onSelectBox(null);
              onSelectSource(null);
            }}
            className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-medium transition-all min-w-0 ${
              selectedBoxId === null
                ? "bg-primary/10 border border-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
              <Folder className="h-4 w-4 shrink-0" />
              <span className="truncate text-left">Tüm Konu Kutuları</span>
            </div>
            <Badge
              variant={selectedBoxId === null ? "outline" : "secondary"}
              className="text-[10px] px-1.5 py-0 shrink-0"
            >
              {totalCards}
            </Badge>
          </button>

          <Separator />

          {/* List of Topic Boxes */}
          <div className="space-y-1.5 min-w-0">
            <div className="px-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Tez Konu Kutuları
            </div>

            {boxes.map((box) => {
              const isSelected = selectedBoxId === box.id;
              const boxConfig = getBoxTypeBadgeConfig(box.boxType);
              const boxCardCount = cards.filter(
                (c) => c.boxId === box.id,
              ).length;

              return (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => {
                    onSelectBox(isSelected ? null : box.id);
                    onSelectSource(null);
                  }}
                  className={`w-full text-left p-2.5 rounded-md text-xs transition-all min-w-0 ${
                    isSelected
                      ? "bg-muted border border-border"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1 min-w-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 shrink-0 ${boxConfig.className}`}
                    >
                      {boxConfig.label}
                    </Badge>
                    <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-1.5 py-0 text-[10px] font-mono text-muted-foreground shrink-0">
                      {boxCardCount}
                    </span>
                  </div>
                  <div
                    className="font-medium text-foreground truncate min-w-0"
                    title={box.title}
                  >
                    {box.title}
                  </div>
                </button>
              );
            })}
          </div>

          <Separator />

          {/* Sources under selected scope */}
          <div className="space-y-1.5 min-w-0">
            <div className="px-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Kaynaklar</span>
              {selectedBoxId && (
                <span className="text-[10px] font-normal text-muted-foreground">
                  (Kutuya Özel)
                </span>
              )}
            </div>

            {availableSources.length === 0 ? (
              <div className="px-2 text-xs text-muted-foreground italic">
                Kaynak bulunamadı.
              </div>
            ) : (
              availableSources.map((source) => {
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
                    className={`w-full text-left p-2 rounded-md text-xs flex items-center justify-between gap-2 transition-all min-w-0 ${
                      isSourceSelected
                        ? "bg-primary/10 text-primary font-medium border border-primary/20"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
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
                    <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-1.5 py-0 text-[10px] font-mono text-muted-foreground shrink-0">
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
