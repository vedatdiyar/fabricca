"use client";

import { Outline } from "@/db/schema";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Quote, FileText } from "lucide-react";
import { isIntroOrConclusion } from "../../utils/outline-helpers";

interface SectionDetailCardProps {
  outline: Outline;
  cardsCount: number;
  sourcesCount: number;
  onAddSub: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Header card of the selected section: badges, title, action toolbar and the
 * linked citation-card/source summary bar.
 *
 * @param root0 - Component props.
 * @param root0.outline - The selected outline section.
 * @param root0.cardsCount - Pinned citation card count of this section.
 * @param root0.sourcesCount - Distinct linked source count of this section.
 * @param root0.onAddSub - Sub-section creation handler.
 * @param root0.onEdit - Section edit handler.
 * @param root0.onDelete - Section delete handler.
 */
export function SectionDetailCard({
  outline,
  cardsCount,
  sourcesCount,
  onAddSub,
  onEdit,
  onDelete,
}: SectionDetailCardProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="p-4 sm:p-5 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0 flex-1">
            {/* Status Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 text-primary text-[11px] font-mono"
              >
                {outline.parentId ? "Alt Bölüm" : "Ana Bölüm"}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-mono">
                Sıra #{outline.sortOrder}
              </Badge>
            </div>

            {/* Title */}
            <CardTitle className="font-serif text-xl font-semibold text-foreground leading-snug break-words">
              {outline.title}
            </CardTitle>
          </div>

          {/* Header Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0 pt-1">
            {!outline.parentId && !isIntroOrConclusion(outline.title) && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={onAddSub}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Alt Bölüm</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Düzenle</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
              title="Bölümü Sil"
              aria-label="Bölümü Sil"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scope & Description Block (Full Width) */}
        <div className="w-full rounded-md border border-border/40 bg-muted/15 p-3.5 text-xs sm:text-sm text-foreground/90 leading-relaxed font-sans">
          {outline.description ? (
            <p className="whitespace-pre-line">{outline.description}</p>
          ) : (
            <p className="text-muted-foreground italic">
              Bu bölümün yazım kapsamı ve tartışma odağı henüz tanımlanmamış.
              Sağ üstteki &quot;Düzenle&quot; butonundan kapsam
              belirtebilirsiniz.
            </p>
          )}
        </div>

        {/* Linked Citation Cards & Sources Summary Bar */}
        <div className="pt-2 border-t border-border/40 flex items-center gap-x-4 gap-y-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Quote className="h-3.5 w-3.5 text-emerald-500" />
            <span>{cardsCount} Alıntı Kartı</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5 text-amber-500" />
            <span>{sourcesCount} Kaynak</span>
          </span>
        </div>
      </CardHeader>
    </Card>
  );
}
