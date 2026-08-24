"use client";

import { Outline } from "@/core/db/schema";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Quote } from "lucide-react";
import { isIntroOrConclusion } from "../../utils/outline-helpers";

interface SectionDetailCardProps {
  outline: Outline;
  cardsCount: number;
  sourcesCount?: number;
  isParentWithChildren?: boolean;
  subSectionsCount?: number;
  onAddSub: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Header card of the selected section: badges, title, action toolbar and the
 * linked citation-card summary bar.
 *
 * @param root0 - Component props.
 * @param root0.outline - The selected outline section.
 * @param root0.cardsCount - Pinned citation card count of this section.
 * @param root0.sourcesCount - Optional source count of this section.
 * @param root0.isParentWithChildren - Whether this is a parent chapter with sub-sections.
 * @param root0.subSectionsCount - Number of child sub-sections.
 * @param root0.onAddSub - Sub-section creation handler.
 * @param root0.onEdit - Section edit handler.
 * @param root0.onDelete - Section delete handler.
 */
export function SectionDetailCard({
  outline,
  cardsCount,
  isParentWithChildren = false,
  subSectionsCount = 0,
  onAddSub,
  onEdit,
  onDelete,
}: SectionDetailCardProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="p-4 sm:p-5 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 flex-wrap">
            {/* Status Badge */}
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 text-primary text-[11px] font-mono shrink-0"
            >
              {outline.parentId
                ? "Alt Bölüm"
                : isParentWithChildren
                  ? `Ana Bölüm (${subSectionsCount} Alt Bölüm)`
                  : "Ana Bölüm (Tekil)"}
            </Badge>

            {/* Title */}
            <CardTitle className="font-serif text-sm font-semibold text-foreground leading-snug break-words">
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

        {/* Linked Citation Cards Summary Bar */}
        <div className="pt-2 border-t border-border/40 flex items-center gap-x-4 gap-y-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Quote className="h-3.5 w-3.5 text-primary" />
            <span>{cardsCount} Alıntı Fişi / Malzeme</span>
          </span>
        </div>
      </CardHeader>
    </Card>
  );
}
