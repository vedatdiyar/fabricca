"use client";

import { MessageSquareQuote, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { getNoteTypeBadgeConfig } from "./citation-card";
import type { CitationCardItem } from "../_lib/types";

/** Props for the read-only citation card view. */
export interface CitationCardViewProps {
  card: CitationCardItem;
  onEdit: () => void;
  onClose: () => void;
}

/**
 * Read-only display of an existing citation card with an edit entry point.
 *
 * @param props - Card data and action callbacks.
 * @returns Read-only card view markup.
 */
export function CitationCardView(props: CitationCardViewProps) {
  const { card, onEdit, onClose } = props;

  const noteConfig = getNoteTypeBadgeConfig(card.noteType);
  const NoteIcon = noteConfig.icon;
  const boxConfig = getBoxTypeBadgeConfig(card.boxType);

  const authorsDisplay =
    card.sourceAuthors.length > 2
      ? `${card.sourceAuthors[0]} ve diğerleri`
      : card.sourceAuthors.join(" & ");

  return (
    <div className="space-y-4 py-2">
      {/* Kaynak & Konu Kutusu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Akademik Kaynak</Label>
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {card.sourceTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {authorsDisplay} ({card.sourceYear})
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Bağlı Konu Kutusu</Label>
          <Badge
            variant="outline"
            className={`flex items-center gap-1 text-xs font-medium w-fit ${boxConfig.className}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${boxConfig.dotClassName}`}
            />
            {card.boxTitle}
          </Badge>
        </div>
      </div>

      {/* Not Türü & Sayfa Numarası */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Not Türü</Label>
          <Badge
            variant="outline"
            className={`flex items-center gap-1 text-xs font-medium w-fit ${noteConfig.className}`}
          >
            <NoteIcon className="h-3 w-3 shrink-0" />
            {noteConfig.label}
          </Badge>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Sayfa Numarası</Label>
          <p className="font-mono text-sm font-semibold text-foreground">
            {card.pageNumber}
          </p>
        </div>
      </div>

      {/* Fiş İçeriği */}
      <div className="space-y-2">
        <Label className="text-xs">Fiş İçeriği (Metin)</Label>
        <blockquote className="rounded-md border-l-2 border-primary/20 bg-muted/20 p-3 font-serif text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {card.content}
        </blockquote>
      </div>

      {/* Kişisel Yorum / Şerh (Opsiyonel) */}
      {card.comment && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="h-3.5 w-3.5 text-primary" />
            <Label className="text-sm font-medium">Düşünce / Şerh</Label>
          </div>
          <p className="rounded-md border border-border/40 bg-card p-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {card.comment}
          </p>
        </div>
      )}

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="h-8 w-24"
        >
          Kapat
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onEdit}
          className="h-8 w-24 gap-2"
        >
          <Pencil className="h-3.5 w-3.5" />
          Düzenle
        </Button>
      </DialogFooter>
    </div>
  );
}