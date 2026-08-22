"use client";

import {
  MessageSquareQuote,
  Pencil,
  Copy,
  Check,
  BookOpen,
  FolderOpen,
  FolderTree,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { formatPageNumber } from "@/lib/academic/utils";
import { cn } from "@/lib/utils";
import { getNoteTypeBadgeConfig } from "./citation-card";
import type { CitationCardItem } from "../_lib/types";

/** Props for the read-only citation card view. */
export interface CitationCardViewProps {
  card: CitationCardItem;
  onEdit: () => void;
  onClose: () => void;
}

/**
 * High-legibility, academic read-only modal view for an individual citation card.
 *
 * @param props - Card data and action callbacks.
 * @returns Read-only card view markup.
 */
export function CitationCardView(props: CitationCardViewProps) {
  const { card, onEdit, onClose } = props;
  const [copied, setCopied] = useState(false);

  const noteConfig = getNoteTypeBadgeConfig(card.noteType);
  const NoteIcon = noteConfig.icon;
  const boxConfig = getBoxTypeBadgeConfig(card.boxType);
  const formattedPage = formatPageNumber(card.pageNumber);

  const authorsDisplay =
    card.sourceAuthors.length > 2
      ? `${card.sourceAuthors[0]} vd.`
      : card.sourceAuthors.join(" & ") || "Yazar Belirtilmemiş";

  const apaCitation = `"${card.content}" (${authorsDisplay}, ${card.sourceYear}, ${formattedPage})`;

  const handleCopyCitation = () => {
    navigator.clipboard.writeText(apaCitation);
    setCopied(true);
    toast.success("Alıntı ve akademik atıf panoya kopyalandı.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 py-1">
      {/* Top Metadata Card: Source, Box & Outline Info */}
      <div className="rounded-md border border-border bg-muted/30 p-3.5 space-y-2.5">
        {/* Row 1: Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Note Type Badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold border",
                noteConfig.className,
              )}
            >
              <NoteIcon className="h-3.5 w-3.5 shrink-0" />
              {noteConfig.label}
            </span>

            {/* Topic Box Badge (Origin) */}
            <Badge
              variant="outline"
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium border-border/60 bg-background text-foreground",
              )}
            >
              <FolderOpen className="h-3 w-3 text-muted-foreground shrink-0" />
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  boxConfig.dotClassName,
                )}
              />
              <span className="truncate max-w-[200px]">{card.boxTitle}</span>
            </Badge>

            {/* Outline Section Badge (Destination) */}
            {card.outlineTitles && card.outlineTitles.length > 0 ? (
              <Badge
                variant="outline"
                className="flex items-center gap-1.5 text-xs font-medium border-primary/30 bg-primary/10 text-primary"
              >
                <FolderTree className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[220px]">
                  {card.outlineTitles[0]}
                </span>
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs font-normal border-dashed border-warning/20 text-warning bg-warning/10"
              >
                ⚠️ Bölüme Atanmamış
              </Badge>
            )}
          </div>

          {/* Page Number Badge */}
          <span className="font-mono text-xs font-semibold text-foreground bg-background border border-border px-2.5 py-0.5 rounded">
            {formattedPage}
          </span>
        </div>

        {/* Row 2: Source Details */}
        <div className="flex items-start gap-2.5 pt-2 border-t border-border/40">
          <BookOpen className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <h4 className="text-sm font-semibold text-foreground leading-snug">
              {card.sourceTitle}
            </h4>
            <p className="text-xs text-muted-foreground">
              {card.sourceAuthors.join(", ")} ({card.sourceYear})
            </p>
          </div>
        </div>
      </div>

      {/* Main Citation Text Content */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Fiş İçeriği (Alıntı / Metin)
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyCitation}
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-primary" />
                <span>Kopyalandı</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Metni Kopyala</span>
              </>
            )}
          </Button>
        </div>

        <div className="rounded-md border border-border bg-card p-4">
          <blockquote className="text-sm leading-relaxed text-foreground whitespace-pre-wrap select-text font-sans">
            {card.noteType === "DIRECT_QUOTE"
              ? `“${card.content}”`
              : card.content}
          </blockquote>
        </div>
      </div>

      {/* Researcher's Commentary / Şerh (If exists) */}
      {card.comment && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-primary text-xs font-medium">
            <MessageSquareQuote className="h-3.5 w-3.5 shrink-0" />
            <span>Araştırmacı Düşüncesi / Şerh</span>
          </div>
          <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap select-text pl-5">
            {card.comment}
          </p>
        </div>
      )}

      {/* Footer Controls */}
      <DialogFooter className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-[10px] text-muted-foreground font-mono truncate max-w-sm">
          Atıf: ({authorsDisplay}, {card.sourceYear}, {formattedPage})
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 px-4 text-xs"
          >
            Kapat
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onEdit}
            className="h-8 px-4 text-xs gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Düzenle
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}
