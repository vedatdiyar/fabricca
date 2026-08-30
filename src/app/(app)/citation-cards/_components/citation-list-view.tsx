"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  Pencil,
  Trash2,
  FolderTree,
  MoreVertical,
  MessageSquareQuote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNoteTypeBadgeConfig } from "./citation-card";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { formatPageNumber } from "@/lib/academic/utils";
import { cn } from "@/lib/utils";
import type { CitationCardItem, BoxItem } from "../_lib/types";

interface CitationListViewProps {
  cards: CitationCardItem[];
  availableBoxes?: BoxItem[];
  selectedCardId?: number | null;
  onView: (card: CitationCardItem) => void;
  onEdit: (card: CitationCardItem) => void;
  onDelete: (id: number) => void;
  onMoveBox?: (cardId: number, targetBoxId: number) => void;
}

/**
 * High-density tabular list view for academic citation cards.
 * Enables quick scanning, reading, and comparison across multiple citations.
 *
 * @param props - Component props.
 * @returns Rendered list markup.
 */
export function CitationListView({
  cards,
  selectedCardId,
  onView,
  onEdit,
  onDelete,
}: CitationListViewProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopyCitation = (card: CitationCardItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const authors =
      card.sourceAuthors.length > 2
        ? `${card.sourceAuthors[0]} vd.`
        : card.sourceAuthors.join(" & ") || "Yazar Belirtilmemiş";
    const formattedPage = formatPageNumber(card.pageNumber);
    const citationText = `"${card.content}" (${authors}, ${card.sourceYear}, ${formattedPage})`;

    navigator.clipboard.writeText(citationText);
    setCopiedId(card.id);
    toast.success("Alıntı ve akademik atıf kopyalandı.");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-3 w-full select-none">
      {cards.map((card) => {
        const noteConfig = getNoteTypeBadgeConfig(card.noteType);
        const NoteIcon = noteConfig.icon;
        const boxConfig = getBoxTypeBadgeConfig(card.boxType);
        const formattedPage = formatPageNumber(card.pageNumber);
        const isSelected = selectedCardId === card.id;
        const isAssigned = card.outlineIds.length > 0;
        const outlineTitle = card.outlineTitles?.[0] || null;

        const authorsDisplay =
          card.sourceAuthors.length > 2
            ? `${card.sourceAuthors[0]} vd.`
            : card.sourceAuthors.join(" & ") || "Yazar";

        return (
          <div
            key={card.id}
            role="button"
            tabIndex={0}
            onClick={() => onView(card)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onView(card);
              }
            }}
            className={cn(
              "group relative flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-lg border bg-card/60 hover:bg-card hover:border-border/80 transition-all duration-150 cursor-pointer shadow-xs",
              isSelected
                ? "border-primary/80 ring-1 ring-primary/20 bg-primary/5"
                : "border-border/50",
            )}
          >
            {/* 1. Top Header: Outline Badge + Note Type Badge on Left, Page & Actions on Right */}
            <div className="flex items-center justify-between gap-2 w-full min-w-0">
              {/* Left Badges */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {/* Note Type Pill */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted/60 text-foreground/80 border border-border/50 shrink-0">
                  <NoteIcon className="size-3 text-primary shrink-0" />
                  <span>{noteConfig.label}</span>
                </span>

                {/* Outline Section Badge */}
                {isAssigned && outlineTitle ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 truncate max-w-[280px] sm:max-w-md"
                    title={`Tez Bölümü: ${outlineTitle}`}
                  >
                    <FolderTree className="size-3 shrink-0" />
                    <span className="truncate">{outlineTitle}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-warning/10 text-warning border border-warning/20 shrink-0">
                    Atanmamış
                  </span>
                )}
              </div>

              {/* Right: Page & Actions */}
              <div
                role="presentation"
                className="flex items-center gap-1.5 shrink-0 ml-auto"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {/* Page Badge */}
                <span className="font-mono text-[10px] font-medium text-muted-foreground bg-muted/50 border border-border/40 px-1.5 py-0.5 rounded">
                  {formattedPage}
                </span>

                {/* Action Buttons */}
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleCopyCitation(card, e)}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Atıf Metnini Kopyala"
                  >
                    {copiedId === card.id ? (
                      <Check className="size-3 text-primary" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Diğer Seçenekler"
                      >
                        <MoreVertical className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 text-xs">
                      <DropdownMenuItem
                        onClick={() => onEdit(card)}
                        className="gap-2 cursor-pointer"
                      >
                        <Pencil className="size-3.5" />
                        <span>Düzenle</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => handleCopyCitation(card, e)}
                        className="gap-2 cursor-pointer"
                      >
                        <Copy className="size-3.5" />
                        <span>Atıf Kopyala</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(card.id)}
                        className="gap-2 text-destructive cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Sil</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            {/* 2. Main Quote Text */}
            <p
              className={cn(
                "text-[12.5px] leading-relaxed text-foreground/90 select-text font-normal",
                noteConfig.quoteClass,
              )}
            >
              {card.noteType === "DIRECT_QUOTE"
                ? `“${card.content}”`
                : card.content}
            </p>

            {/* 3. Commentary / Şerh (if present) */}
            {card.comment && (
              <div className="flex items-start gap-1.5 rounded-md bg-muted/20 px-2.5 py-1.5 text-muted-foreground border border-border/30">
                <MessageSquareQuote className="size-3 text-muted-foreground/60 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-snug whitespace-pre-wrap select-text font-sans text-muted-foreground/90">
                  <span className="font-semibold text-[10px] uppercase tracking-wider text-foreground/80 mr-1">
                    Şerh:
                  </span>
                  {card.comment}
                </p>
              </div>
            )}

            {/* 4. Footer: Clean Academic Source Reference */}
            <div className="pt-1.5 border-t border-border/30 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    boxConfig.dotClassName,
                  )}
                  title={`Konu Kutusu: ${card.boxTitle}`}
                />
                <div className="text-[11px] text-muted-foreground truncate leading-tight">
                  <strong className="text-foreground/90 font-medium">
                    {authorsDisplay} ({card.sourceYear})
                  </strong>
                  <span className="mx-1 text-muted-foreground/40">—</span>
                  <span
                    className="italic text-muted-foreground/80"
                    title={card.sourceTitle}
                  >
                    {card.sourceTitle}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
