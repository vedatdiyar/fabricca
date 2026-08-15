"use client";

import { Outline, Box } from "@/db/schema";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderKanban, Plus, Pencil, Trash2 } from "lucide-react";
import { getBoxTypeBadgeConfig, ThesisBoxType } from "@/lib/box-constants";
import { isIntroOrConclusion } from "../../utils/outline-helpers";

interface SectionDetailCardProps {
  outline: Outline;
  sectionBoxes: Box[];
  onAddSub: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onManageBoxLinks: () => void;
}

/**
 * Header card of the selected section: badges, title, action toolbar, scope
 * description and the linked topic boxes bar.
 *
 * @param root0 - Component props.
 * @param root0.outline - The selected outline section.
 * @param root0.sectionBoxes - Topic boxes linked to this section.
 * @param root0.onAddSub - Sub-section creation handler.
 * @param root0.onEdit - Section edit handler.
 * @param root0.onDelete - Section delete handler.
 * @param root0.onManageBoxLinks - Box link management handler.
 */
export function SectionDetailCard({
  outline,
  sectionBoxes,
  onAddSub,
  onEdit,
  onDelete,
  onManageBoxLinks,
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

        {/* Linked Topic Boxes Bar */}
        <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
            <span className="font-sans text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FolderKanban className="h-3.5 w-3.5 text-primary" />
              <span>Bağlı Araştırma Eksenleri:</span>
            </span>
            {sectionBoxes.length > 0 ? (
              sectionBoxes.map((b) => {
                const badgeCfg = getBoxTypeBadgeConfig(
                  b.boxType as ThesisBoxType,
                );
                return (
                  <Badge
                    key={b.id}
                    variant="outline"
                    className={`text-[10px] font-sans font-medium px-2 py-0.5 border ${badgeCfg.className}`}
                  >
                    {b.title}
                  </Badge>
                );
              })
            ) : (
              <span className="text-xs text-muted-foreground italic">
                Henüz konu kutusu bağlanmadı.
              </span>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={onManageBoxLinks}
            className="h-7 text-xs gap-1.5 shrink-0"
          >
            <FolderKanban className="h-3 w-3" />
            <span>Kutuları Yönet</span>
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}
