"use client";

import Link from "next/link";
import { Source } from "@/db/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, FileText, ExternalLink, FolderKanban } from "lucide-react";
import { SectionSourceItem } from "./section-source-item";

interface SectionSourcesListProps {
  outlineId: number;
  sectionSources: Source[];
  displayedSources: Source[];
  sourceSearchQuery: string;
  activeFocusedSourceIds: number[];
  onSourceSearchChange: (query: string) => void;
  onToggleFocus: (outlineId: number, sourceId: number) => void;
  onManageBoxLinks: () => void;
}

/**
 * Reading sources workspace of the selected section: header, search bar,
 * source list and empty states.
 *
 * @param root0 - Component props.
 * @param root0.outlineId - Id of the selected section.
 * @param root0.sectionSources - All sources linked to this section.
 * @param root0.displayedSources - Filtered/sorted sources to render.
 * @param root0.sourceSearchQuery - The current source search query.
 * @param root0.activeFocusedSourceIds - Focused source ids of this section.
 * @param root0.onSourceSearchChange - Search query mutator.
 * @param root0.onToggleFocus - Focus toggle handler.
 * @param root0.onManageBoxLinks - Box link management handler.
 */
export function SectionSourcesList({
  outlineId,
  sectionSources,
  displayedSources,
  sourceSearchQuery,
  activeFocusedSourceIds,
  onSourceSearchChange,
  onToggleFocus,
  onManageBoxLinks,
}: SectionSourcesListProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="font-serif text-base font-semibold text-foreground">
              Okuma Kaynakları
            </CardTitle>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] px-2 py-0.5"
            >
              {sectionSources.length} Kaynak
            </Badge>
          </div>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
          >
            <Link href="/library">
              <span>Tüm Kütüphaneyi Aç</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-4 space-y-4">
        {/* Search Bar for Sources */}
        {sectionSources.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={sourceSearchQuery}
              onChange={(e) => onSourceSearchChange(e.target.value)}
              placeholder="Bağlı kaynaklarda başlık, yazar veya yayıncı ara..."
              className="h-8 pl-8 pr-7 text-xs bg-background/50 border-border/60"
            />
            {sourceSearchQuery && (
              <button
                type="button"
                onClick={() => onSourceSearchChange("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {displayedSources.length > 0 ? (
          <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
            {displayedSources.map((source) => (
              <SectionSourceItem
                key={source.id}
                source={source}
                isFocused={activeFocusedSourceIds.includes(source.id)}
                onToggleFocus={() => onToggleFocus(outlineId, source.id)}
              />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center space-y-2 border border-dashed border-border/60 rounded-lg bg-muted/5">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <p className="font-serif text-sm font-semibold text-foreground">
                {sourceSearchQuery
                  ? "Aramanızla eşleşen kaynak bulunamadı."
                  : "Bu bölüme henüz bağlı bir okuma kaynağı bulunmuyor."}
              </p>
              <p className="font-sans text-xs text-muted-foreground max-w-sm mx-auto">
                Bu bölüme &quot;Kutuları Yönet&quot; butonuyla araştırma
                eksenleri bağlayarak ilgili kaynakların buraya otomatik
                yansımasını sağlayabilirsiniz.
              </p>
            </div>
            {!sourceSearchQuery && (
              <Button
                size="sm"
                variant="outline"
                onClick={onManageBoxLinks}
                className="text-xs gap-1.5"
              >
                <FolderKanban className="h-3.5 w-3.5" />
                <span>Konu Kutusu Bağla</span>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
