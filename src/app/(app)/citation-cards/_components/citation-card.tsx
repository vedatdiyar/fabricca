"use client";

import {
  BookOpen,
  Copy,
  Check,
  Trash2,
  Quote,
  Sparkles,
  Bookmark,
  FolderInput,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
      };
    case "PARAPHRASE":
      return {
        label: "Dolaylı Alıntı",
        icon: Sparkles,
        className:
          "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
      };
    case "PERSONAL_NOTE":
      return {
        label: "Kişisel Not",
        icon: Bookmark,
        className:
          "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
      };
    default:
      return {
        label: "Not",
        icon: BookOpen,
        className: "bg-muted text-muted-foreground border-border",
      };
  }
}

/** Props for CitationCard component. */
export interface CitationCardProps {
  card: CitationCardItem;
  viewMode: "grid" | "list";
  availableBoxes: BoxItem[];
  onEdit: (card: CitationCardItem) => void;
  onDelete: (id: number) => void;
  onMoveBox: (cardId: number, targetBoxId: number) => void;
}

/**
 * Renders an individual academic citation card. Clicking the card opens the edit modal.
 *
 * @param props - Component props containing card data and callbacks.
 * @returns Rendered citation card component markup.
 */
export function CitationCard(props: CitationCardProps) {
  const { card, viewMode, availableBoxes, onEdit, onDelete, onMoveBox } = props;
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

  if (viewMode === "list") {
    return (
      <Card
        onClick={() => onEdit(card)}
        className="cursor-pointer rounded-md border border-border bg-card p-4 transition-all hover:border-primary/50 backdrop-blur-sm group"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 flex-col gap-2 min-w-0">
            {/* Top row: Compact badges and page number */}
            <div className="flex flex-row items-center gap-1.5 min-w-0 overflow-hidden">
              <Badge
                variant="outline"
                className={`flex items-center gap-1 text-[10px] py-0.5 px-1.5 font-medium shrink-0 whitespace-nowrap ${noteConfig.className}`}
              >
                <NoteIcon className="h-3 w-3 shrink-0" />
                {noteConfig.label}
              </Badge>

              <Badge
                variant="outline"
                className={`flex items-center gap-1 text-[10px] py-0.5 px-1.5 font-medium shrink-0 min-w-0 ${boxConfig.className}`}
                title={card.boxTitle}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${boxConfig.dotClassName}`}
                />
                <span className="truncate max-w-[140px] md:max-w-[190px]">
                  {card.boxTitle}
                </span>
              </Badge>

              <span className="font-mono text-xs font-semibold text-foreground bg-muted border border-border px-2 py-0.5 rounded-md shrink-0 ml-auto md:ml-0">
                {card.pageNumber}
              </span>
            </div>

            <p className="text-sm leading-relaxed text-foreground font-serif line-clamp-2">
              {card.content}
            </p>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium text-foreground truncate">
                {card.sourceTitle}
              </span>
              <span>•</span>
              <span>
                {authorsDisplay} ({card.sourceYear})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-border/40 w-full md:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCitation}
              className="h-8 gap-1.5 text-xs whitespace-nowrap"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Copy className="h-3.5 w-3.5 shrink-0" />
              )}
              Atıf Kopyala
            </Button>

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
                onDelete(card.id);
              }}
              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
              title="Fişi Sil"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      onClick={() => onEdit(card)}
      className="cursor-pointer rounded-md border border-border bg-card p-5 transition-all duration-200 hover:border-primary/50 flex flex-col justify-between backdrop-blur-sm group"
    >
      <CardHeader className="p-0 mb-3 flex-row items-center justify-between gap-2 space-y-0">
        {/* Left: Compact Note Type & Topic Box Badges side-by-side */}
        <div className="flex flex-row items-center gap-1 min-w-0 overflow-hidden">
          <Badge
            variant="outline"
            className={`flex items-center gap-1 text-[10px] py-0.5 px-1.5 font-medium shrink-0 whitespace-nowrap ${noteConfig.className}`}
          >
            <NoteIcon className="h-3 w-3 shrink-0" />
            {noteConfig.label}
          </Badge>

          <Badge
            variant="outline"
            className={`flex items-center gap-1 text-[10px] py-0.5 px-1.5 font-medium shrink-0 min-w-0 ${boxConfig.className}`}
            title={card.boxTitle}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${boxConfig.dotClassName}`}
            />
            <span className="truncate max-w-[130px] sm:max-w-[170px]">
              {card.boxTitle}
            </span>
          </Badge>
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
        <blockquote className="relative border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-foreground font-serif">
          {card.content}
        </blockquote>
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
