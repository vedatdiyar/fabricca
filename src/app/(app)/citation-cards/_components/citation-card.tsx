"use client";

import {
  Copy,
  Check,
  Pencil,
  Trash2,
  Quote,
  Sparkles,
  Bookmark,
  BookOpen,
  MessageSquareQuote,
  FolderTree,
  MoreVertical,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { formatPageNumber } from "@/lib/academic/utils";
import { cn } from "@/lib/utils";
import type {
  CitationCardItem,
  CitationNoteType,
  BoxItem,
} from "../_lib/types";

/**
 * Returns badge styling and Turkish label for a given citation note type.
 *
 * @param noteType - The citation note type enum value.
 * @returns Config object with label, icon, and Tailwind style classes.
 */
export function getNoteTypeBadgeConfig(noteType: CitationNoteType) {
  switch (noteType) {
    case "DIRECT_QUOTE":
      return {
        label: "Doğrudan Alıntı",
        icon: Quote,
        className: "bg-secondary text-secondary-foreground border-border",
        borderAccent: "border-l-primary",
        quoteClass: "font-serif text-foreground italic",
      };
    case "PARAPHRASE":
      return {
        label: "Dolaylı Alıntı",
        icon: Sparkles,
        className: "bg-secondary text-secondary-foreground border-border",
        borderAccent: "border-l-primary/60",
        quoteClass: "font-sans text-foreground",
      };
    case "PERSONAL_NOTE":
      return {
        label: "Kişisel Not",
        icon: Bookmark,
        className: "bg-secondary text-secondary-foreground border-border",
        borderAccent: "border-l-border",
        quoteClass: "font-sans text-foreground",
      };
    default:
      return {
        label: "Not",
        icon: BookOpen,
        className: "bg-secondary text-secondary-foreground border-border",
        borderAccent: "border-l-border",
        quoteClass: "font-sans text-foreground",
      };
  }
}

/** Props for CitationCard component. */
export interface CitationCardProps {
  card: CitationCardItem;
  availableBoxes?: BoxItem[];
  isSelected?: boolean;
  onView: (card: CitationCardItem) => void;
  onEdit: (card: CitationCardItem) => void;
  onDelete: (id: number) => void;
  onMoveBox?: (cardId: number, targetBoxId: number) => void;
}

/**
 * Redesigned, ultra-clean academic citation index card.
 * Adheres strictly to Emerald Minimalism, 5-layer typography, and quiet hover interactions.
 *
 * @param props - Component props.
 * @returns Rendered citation card component markup.
 */
export function CitationCard(props: CitationCardProps) {
  const { card, isSelected = false, onView, onEdit, onDelete } = props;
  const [copied, setCopied] = useState(false);

  const noteConfig = getNoteTypeBadgeConfig(card.noteType);
  const NoteIcon = noteConfig.icon;
  const boxConfig = getBoxTypeBadgeConfig(card.boxType);

  const isAssigned = card.outlineIds.length > 0;
  const outlineTitle = card.outlineTitles?.[0] || null;

  // Single page: s. X | Multiple pages: ss. X-Y
  const formattedPage = formatPageNumber(card.pageNumber);

  const authorsDisplay =
    card.sourceAuthors.length > 2
      ? `${card.sourceAuthors[0]} vd.`
      : card.sourceAuthors.join(" & ") || "Yazar Belirtilmemiş";

  const handleCopyCitation = (e: React.MouseEvent) => {
    e.stopPropagation();
    const citationText = `"${card.content}" (${authorsDisplay}, ${card.sourceYear}, ${formattedPage})`;

    navigator.clipboard.writeText(citationText);
    setCopied(true);
    toast.success("Alıntı ve akademik atıf kopyalandı.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card
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
        "cursor-pointer rounded-xl p-3.5 transition-all duration-200 border bg-card/60 hover:bg-card hover:border-border/80 flex flex-col justify-between group select-none w-full gap-2.5 relative overflow-hidden shadow-xs",
        isSelected
          ? "border-primary/80 ring-1 ring-primary/20 bg-primary/5"
          : "border-border/50",
      )}
    >
      {/* 1. Header: Section Badge on Left + Page & Actions on Right */}
      <CardHeader className="p-0 flex-row items-center justify-between gap-2 space-y-0 w-full min-w-0">
        {/* Left: Outline Destination Badge (Has full room to breathe) */}
        <div className="flex items-center min-w-0 flex-1">
          {isAssigned && outlineTitle ? (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 truncate max-w-[260px]"
              title={`Tez Bölümü: ${outlineTitle}`}
            >
              <FolderTree className="size-3 shrink-0" />
              <span className="truncate">{outlineTitle}</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 shrink-0"
              title="Henüz bir tez bölümüne bağlanmadı"
            >
              <span>Atanmamış</span>
            </span>
          )}
        </div>

        {/* Right: Page Number & Actions */}
        <div
          role="presentation"
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* Page Badge */}
          <span className="font-mono text-[10px] font-medium text-muted-foreground bg-muted/50 border border-border/40 px-1.5 py-0.5 rounded">
            {formattedPage}
          </span>

          {/* Actions Menu (Always visible) */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyCitation}
              className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Atıf Metnini Kopyala"
            >
              {copied ? (
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
              <DropdownMenuContent align="end" className="w-40 text-xs">
                <DropdownMenuItem
                  onClick={() => onEdit(card)}
                  className="gap-2 cursor-pointer"
                >
                  <Pencil className="size-3.5" />
                  <span>Düzenle</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleCopyCitation}
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
                  <span>Fişi Sil</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {/* 2. Main Quote Body with Note Type Intro */}
      <CardContent className="p-0 flex-1 space-y-2">
        {/* Note Type Subtle Tag */}
        <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80">
          <NoteIcon className="size-3 text-primary/80 shrink-0" />
          <span>{noteConfig.label}</span>
        </div>

        {/* Quote Content (Refined, proportional academic typography) */}
        <p
          className={cn(
            "text-[12.5px] leading-relaxed line-clamp-4 select-text text-foreground/90",
            noteConfig.quoteClass,
          )}
        >
          {card.noteType === "DIRECT_QUOTE"
            ? `“${card.content}”`
            : card.content}
        </p>

        {/* 3. Commentary / Şerh (Discreet, compact margin note) */}
        {card.comment && (
          <div className="flex items-start gap-1.5 rounded-md border-l-2 border-border/80 bg-muted/20 px-2 py-1 text-muted-foreground">
            <MessageSquareQuote className="size-3 text-muted-foreground/60 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-snug whitespace-pre-wrap line-clamp-2 select-text font-sans text-muted-foreground/90">
              <span className="font-semibold text-[10px] uppercase tracking-wider text-foreground/80 mr-1">
                Şerh:
              </span>
              {card.comment}
            </p>
          </div>
        )}
      </CardContent>

      {/* 4. Footer: Clean Academic Source Reference */}
      <CardFooter className="p-0 pt-2 border-t border-border/30 flex items-center justify-between gap-2 text-xs">
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
      </CardFooter>
    </Card>
  );
}
