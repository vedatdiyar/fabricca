"use client";

import {
  BookOpen,
  Copy,
  Check,
  Pencil,
  Trash2,
  Quote,
  Sparkles,
  Bookmark,
  FolderInput,
  MessageSquareQuote,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
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
        textClassName: "text-emerald-600 dark:text-emerald-400",
        borderAccent: "border-l-emerald-500",
      };
    case "PARAPHRASE":
      return {
        label: "Dolaylı Alıntı",
        icon: Sparkles,
        className:
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        textClassName: "text-blue-600 dark:text-blue-400",
        borderAccent: "border-l-blue-500",
      };
    case "PERSONAL_NOTE":
      return {
        label: "Kişisel Not",
        icon: Bookmark,
        className:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        textClassName: "text-amber-600 dark:text-amber-400",
        borderAccent: "border-l-amber-500",
      };
    default:
      return {
        label: "Not",
        icon: BookOpen,
        className: "bg-muted text-muted-foreground border-border",
        textClassName: "text-muted-foreground",
        borderAccent: "border-l-primary",
      };
  }
}

/** Props for CitationCard component. */
export interface CitationCardProps {
  card: CitationCardItem;
  availableBoxes: BoxItem[];
  onView: (card: CitationCardItem) => void;
  onEdit: (card: CitationCardItem) => void;
  onDelete: (id: number) => void;
  onMoveBox: (cardId: number, targetBoxId: number) => void;
}

/**
 * Renders an individual academic citation card with elevated typography and quick actions.
 *
 * @param props - Component props containing card data and callbacks.
 * @returns Rendered citation card component markup.
 */
export function CitationCard(props: CitationCardProps) {
  const { card, availableBoxes, onView, onEdit, onDelete, onMoveBox } = props;
  const [copied, setCopied] = useState(false);

  const noteConfig = getNoteTypeBadgeConfig(card.noteType);
  const NoteIcon = noteConfig.icon;
  const boxConfig = getBoxTypeBadgeConfig(card.boxType);

  /**
   * Formats the citation reference string and copies it with card content to the clipboard.
   *
   * @param e - React click event to stop propagation.
   */
  const handleCopyCitation = (e: React.MouseEvent) => {
    e.stopPropagation();
    const authorsStr =
      card.sourceAuthors.length > 2
        ? `${card.sourceAuthors[0]} vd.`
        : card.sourceAuthors.join(" & ");
    const citationText = `"${card.content}" (${authorsStr}, ${card.sourceYear}, ${card.pageNumber})`;

    navigator.clipboard.writeText(citationText);
    setCopied(true);
    toast.success("Alıntı ve akademik atıf panoya kopyalandı.");
    setTimeout(() => setCopied(false), 2000);
  };

  const authorsDisplay =
    card.sourceAuthors.length > 2
      ? `${card.sourceAuthors[0]} vd.`
      : card.sourceAuthors.join(" & ");

  return (
    <Card
      onClick={() => onView(card)}
      className="cursor-pointer rounded-md p-4 transition-all duration-200 border-border hover:border-primary/40 bg-card flex flex-col justify-between group select-none w-full"
    >
      {/* Header: Note Type Badge & Topic Box Tag + Quick Actions */}
      <CardHeader className="p-0 pb-3 mb-2.5 border-b border-border/40 flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          {/* Note Type Pill */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0",
              noteConfig.className,
            )}
          >
            <NoteIcon className="h-3 w-3 shrink-0" />
            {noteConfig.label}
          </span>

          {/* Topic Box Pill */}
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/40 max-w-[210px] truncate"
            title={card.boxTitle}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                boxConfig.dotClassName,
              )}
            />
            <span className="truncate">{card.boxTitle}</span>
          </span>
        </div>

        {/* Action Buttons */}
        <div
          role="presentation"
          className="flex items-center gap-0.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <MoveBoxDropdown
            card={card}
            availableBoxes={availableBoxes}
            onMoveBox={onMoveBox}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(card)}
            className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
            title="Fişi Düzenle"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(card.id)}
            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
            title="Fişi Sil"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      {/* Main Card Body */}
      <CardContent className="p-0 my-1 flex-1">
        {card.noteType === "DIRECT_QUOTE" ? (
          <blockquote
            className={cn(
              "relative pl-3 text-sm leading-relaxed text-foreground border-l-2 font-sans line-clamp-4",
              noteConfig.borderAccent,
            )}
          >
            &ldquo;{card.content}&rdquo;
          </blockquote>
        ) : (
          <p className="text-sm leading-relaxed text-foreground font-sans line-clamp-4">
            {card.content}
          </p>
        )}

        {/* Researcher's Commentary / Şerh */}
        {card.comment && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
            <MessageSquareQuote className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-3">
              <span className="font-semibold text-foreground mr-1">Şerh:</span>
              {card.comment}
            </p>
          </div>
        )}
      </CardContent>

      {/* Footer: Academic Source & Citation Pill */}
      <CardFooter className="p-0 mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
        <div className="flex flex-col min-w-0 pr-1">
          <span className="font-semibold text-foreground text-xs truncate">
            {authorsDisplay} ({card.sourceYear})
          </span>
          <span
            className="text-muted-foreground text-[10px] truncate"
            title={card.sourceTitle}
          >
            {card.sourceTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-[10px] font-semibold text-foreground bg-muted/80 border border-border px-2 py-0.5 rounded">
            {card.pageNumber}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyCitation}
            className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
            title="Atıf Metnini Kopyala"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

/** Props for MoveBoxDropdown component. */
interface MoveBoxDropdownProps {
  card: CitationCardItem;
  availableBoxes: BoxItem[];
  onMoveBox: (cardId: number, targetBoxId: number) => void;
}

/**
 * Icon button opening dropdown list to move card to another box.
 *
 * @param props - Component props.
 * @returns Dropdown menu markup.
 */
function MoveBoxDropdown(props: MoveBoxDropdownProps) {
  const { card, availableBoxes, onMoveBox } = props;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
          title="Konu Kutusuna Taşı"
        >
          <FolderInput className="h-3 w-3" />
          <span className="sr-only">Kutuya taşı</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">
          Konu Kutusuna Taşı
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableBoxes.map((box) => (
          <DropdownMenuItem
            key={box.id}
            disabled={box.id === card.boxId}
            onClick={() => onMoveBox(card.id, box.id)}
            className="flex items-center justify-between text-xs cursor-pointer px-3 py-2"
          >
            <span className="truncate">{box.title}</span>
            {box.id === card.boxId && (
              <Check className="h-3 w-3 text-primary shrink-0 ml-1" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
