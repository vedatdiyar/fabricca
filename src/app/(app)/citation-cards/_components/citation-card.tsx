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
        className:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        borderAccent: "border-l-emerald-500",
      };
    case "PARAPHRASE":
      return {
        label: "Dolaylı Alıntı",
        icon: Sparkles,
        className:
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        borderAccent: "border-l-blue-500",
      };
    case "PERSONAL_NOTE":
      return {
        label: "Kişisel Not",
        icon: Bookmark,
        className:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        borderAccent: "border-l-amber-500",
      };
    default:
      return {
        label: "Not",
        icon: BookOpen,
        className: "bg-muted text-muted-foreground border-border",
        borderAccent: "border-l-primary",
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
 * Clean, readable academic citation card.
 * Features exact page formatting (s. X vs ss. X-Y), direct action buttons, and clear typography.
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
      onClick={() => onView(card)}
      className={cn(
        "cursor-pointer rounded-md p-4 transition-all duration-150 border bg-card hover:bg-card/90 flex flex-col justify-between group select-none w-full gap-3",
        isSelected
          ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02]"
          : "border-border/70 hover:border-border",
      )}
    >
      {/* 1. Header: Note Type + Section Badge + Page + Direct Action Buttons */}
      <CardHeader className="p-0 flex-row items-center justify-between gap-2 space-y-0">
        {/* Left: Badges */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          {/* Note Type Pill */}
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border shrink-0",
              noteConfig.className,
            )}
          >
            <NoteIcon className="h-3 w-3 shrink-0" />
            <span>{noteConfig.label}</span>
          </span>

          {/* Outline Destination Pill */}
          {isAssigned && outlineTitle ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 max-w-[200px] truncate shrink-0"
              title={`Tez Bölümü: ${outlineTitle}`}
            >
              <FolderTree className="h-3 w-3 shrink-0" />
              <span className="truncate">{outlineTitle}</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 shrink-0"
              title="Henüz bir tez bölümüne bağlanmadı"
            >
              <span>Atanmamış</span>
            </span>
          )}
        </div>

        {/* Right: Page Number & Direct Actions */}
        <div
          role="presentation"
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Page Badge: s. 1 or ss. 15-18 */}
          <span className="font-mono text-xs font-semibold text-foreground bg-muted/60 border border-border px-2 py-0.5 rounded">
            {formattedPage}
          </span>

          {/* Quick Action Buttons */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyCitation}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Atıf Metnini Kopyala"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(card)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Düzenle"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(card.id)}
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Sil"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* 2. Main Quote Body */}
      <CardContent className="p-0 flex-1">
        <div className={cn("pl-3 border-l-2 py-0.5", noteConfig.borderAccent)}>
          <p className="text-sm leading-relaxed text-foreground font-sans line-clamp-5">
            {card.content}
          </p>
        </div>

        {/* 3. Commentary / Şerh (If present) */}
        {card.comment && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground border border-border/40">
            <MessageSquareQuote className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed whitespace-pre-wrap line-clamp-3">
              <span className="font-semibold text-foreground mr-1">Şerh:</span>
              {card.comment}
            </p>
          </div>
        )}
      </CardContent>

      {/* 4. Footer: Clean Academic Source Reference */}
      <CardFooter className="p-0 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={cn(
              "h-2 w-2 rounded-full shrink-0",
              boxConfig.dotClassName,
            )}
            title={`Kutu: ${card.boxTitle}`}
          />
          <div className="text-xs text-muted-foreground truncate leading-tight">
            <strong className="text-foreground font-medium">
              {authorsDisplay} ({card.sourceYear})
            </strong>
            <span className="mx-1 text-muted-foreground/60">—</span>
            <span className="italic" title={card.sourceTitle}>
              {card.sourceTitle}
            </span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
