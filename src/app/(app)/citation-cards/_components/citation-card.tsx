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
          "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
        textClassName: "text-amber-700 dark:text-amber-300",
      };
    case "PARAPHRASE":
      return {
        label: "Dolaylı Alıntı",
        icon: Sparkles,
        className:
          "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
        textClassName: "text-blue-700 dark:text-blue-300",
      };
    case "PERSONAL_NOTE":
      return {
        label: "Kişisel Not",
        icon: Bookmark,
        className:
          "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
        textClassName: "text-purple-700 dark:text-purple-300",
      };
    default:
      return {
        label: "Not",
        icon: BookOpen,
        className: "bg-muted text-muted-foreground border-border",
        textClassName: "text-muted-foreground",
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
 * Renders an individual academic citation card. Clicking the card opens the read-only view modal.
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
      ? `${card.sourceAuthors[0]} ve diğerleri`
      : card.sourceAuthors.join(" & ");

  return (
    <Card
      onClick={() => onView(card)}
      className="cursor-pointer rounded-md border border-border bg-card p-5 transition-all duration-200 hover:border-primary/50 flex flex-col justify-between backdrop-blur-sm group"
    >
      <CardHeader className="p-0 pb-3 mb-3 border-b border-border/40 flex-row items-start justify-between gap-2 space-y-0">
        {/* Left: Metadata rows (note type & topic box) */}
        <div className="flex flex-col gap-1 min-w-0 pt-0.5">
          <span
            className={`flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${noteConfig.textClassName}`}
          >
            <NoteIcon className="h-3.5 w-3.5 shrink-0" />
            {noteConfig.label}
          </span>

          <span
            className={`flex items-center gap-1.5 text-xs font-medium min-w-0 ${boxConfig.textClassName}`}
            title={card.boxTitle}
          >
            <FolderInput className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{card.boxTitle}</span>
          </span>
        </div>

        {/* Right: Quick Action icons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <MoveBoxDropdown
            card={card}
            availableBoxes={availableBoxes}
            onMoveBox={onMoveBox}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(card);
            }}
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
            title="Fişi Düzenle"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
            title="Fişi Sil"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 my-2 flex-1">
        <blockquote className="relative border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-foreground font-serif line-clamp-4">
          {card.content}
        </blockquote>

        {card.comment && (
          <div className="mt-3 flex gap-2 rounded-md border border-border/40 border-l-2 border-l-primary/40 bg-muted/40 px-2.5 py-2">
            <MessageSquareQuote className="h-3 w-3 text-primary/70 shrink-0 mt-0.5" />
            <p className="text-[11px] text-foreground/75 leading-relaxed whitespace-pre-wrap line-clamp-3">
              {card.comment}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-0 mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-3 text-xs">
        <div className="flex flex-col min-w-0 pr-2">
          <span className="font-semibold text-foreground truncate">
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
          <span className="font-mono text-xs font-semibold text-foreground bg-muted border border-border px-2 py-0.5 rounded-md">
            {card.pageNumber}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyCitation}
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
            title="Atıf Metnini Kopyala"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
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
          onClick={(e) => e.stopPropagation()}
          className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
          title="Konu Kutusuna Taşı"
        >
          <FolderInput className="h-3.5 w-3.5" />
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
            onClick={(e) => {
              e.stopPropagation();
              onMoveBox(card.id, box.id);
            }}
            className="flex items-center justify-between text-xs cursor-pointer px-2.5 py-1.5"
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
