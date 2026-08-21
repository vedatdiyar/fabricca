"use client";

import { useEffect, useState } from "react";
import {
  X,
  Copy,
  Check,
  Pencil,
  Trash2,
  BookOpen,
  FolderTree,
  MessageSquareQuote,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getNoteTypeBadgeConfig } from "./citation-card";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { formatPageNumber } from "@/lib/academic/utils";
import { OutlineSelectItems } from "./outline-select-items";
import type { CitationCardItem, OutlineItem } from "../_lib/types";

interface CitationInspectorProps {
  card: CitationCardItem | null;
  outlines: OutlineItem[];
  onClose: () => void;
  onEdit: (card: CitationCardItem) => void;
  onDelete: (id: number) => void;
  onAssignOutline: (cardId: number, outlineId: number | null) => Promise<void>;
  onPrevCard?: () => void;
  onNextCard?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

/**
 * Slide-over Inspector Panel (Linear & Notion style) for Citation Cards.
 * Allows instant inspection, keyboard navigation, and 1-click outline re-assignment.
 *
 * @param props - Component props.
 * @returns Rendered inspector panel markup or null.
 */
export function CitationInspector({
  card,
  outlines,
  onClose,
  onEdit,
  onDelete,
  onAssignOutline,
  onPrevCard,
  onNextCard,
  hasPrev = false,
  hasNext = false,
}: CitationInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [isUpdatingOutline, setIsUpdatingOutline] = useState(false);

  // Keyboard navigation support (Escape to close, Left/Right for prev/next)
  useEffect(() => {
    if (!card) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && hasPrev && onPrevCard) {
        onPrevCard();
      } else if (e.key === "ArrowRight" && hasNext && onNextCard) {
        onNextCard();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [card, hasPrev, hasNext, onClose, onPrevCard, onNextCard]);

  if (!card) return null;

  const noteConfig = getNoteTypeBadgeConfig(card.noteType);
  const NoteIcon = noteConfig.icon;
  const boxConfig = getBoxTypeBadgeConfig(card.boxType);
  const formattedPage = formatPageNumber(card.pageNumber);

  const currentOutlineId = card.outlineIds[0] ?? null;

  const handleCopy = () => {
    const authorsStr =
      card.sourceAuthors.length > 2
        ? `${card.sourceAuthors[0]} vd.`
        : card.sourceAuthors.join(" & ") || "Yazar Belirtilmemiş";
    const citationText = `"${card.content}" (${authorsStr}, ${card.sourceYear}, ${formattedPage})`;

    navigator.clipboard.writeText(citationText);
    setCopied(true);
    toast.success("Alıntı metni ve atıf kopyalandı.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOutlineChange = async (value: string) => {
    setIsUpdatingOutline(true);
    try {
      const targetOutlineId = value === "NONE" ? null : Number(value);
      await onAssignOutline(card.id, targetOutlineId);
      toast.success(
        targetOutlineId === null
          ? "Fişin bölüm bağı kaldırıldı."
          : "Fiş yeni tez bölümüne bağlandı.",
      );
    } catch (err) {
      console.error("handleOutlineChange error:", err);
      toast.error("Bölüm bağı güncellenirken bir hata oluştu.");
    } finally {
      setIsUpdatingOutline(false);
    }
  };

  return (
    <div className="w-full lg:w-[400px] shrink-0 border-l border-border bg-card flex flex-col h-full overflow-y-auto animate-in slide-in-from-right-4 duration-200">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border",
              noteConfig.className,
            )}
          >
            <NoteIcon className="h-3.5 w-3.5 shrink-0" />
            {noteConfig.label}
          </span>
        </div>

        {/* Card Navigator (< >) + Close button */}
        <div className="flex items-center gap-1">
          {onPrevCard && (
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasPrev}
              onClick={onPrevCard}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Önceki Fiş (←)"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {onNextCard && (
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasNext}
              onClick={onNextCard}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Sonraki Fiş (→)"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-muted-foreground hover:text-foreground ml-1"
            title="Paneli Kapat (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-4 space-y-5 flex-1 text-sm">
        {/* Section 1: Target Outline Assignment (Instant Switcher) */}
        <div className="space-y-1.5 p-3 rounded-md bg-muted/30 border border-border">
          <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5 text-primary" />
              Tez İskeleti / Bölüm Bağı
            </span>
            {isUpdatingOutline && (
              <span className="text-[10px] font-mono text-primary animate-pulse">
                Güncelleniyor...
              </span>
            )}
          </label>

          <Select
            value={currentOutlineId !== null ? String(currentOutlineId) : "NONE"}
            onValueChange={handleOutlineChange}
          >
            <SelectTrigger
              disabled={isUpdatingOutline}
              className="w-full text-xs h-9 bg-background border-border font-medium"
            >
              <SelectValue placeholder="Bölüm Seçin" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <OutlineSelectItems
                outlines={outlines}
                includeNoneOption={true}
                noneLabel="Bölüme Bağlanmadı (Boşta)"
              />
            </SelectContent>
          </Select>
        </div>

        {/* Section 2: Full Quote / Content */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Alıntı Metni
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500">Kopyalandı</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Kopyala</span>
                </>
              )}
            </Button>
          </div>

          <div className="p-3.5 rounded-md border border-border bg-muted/10 font-sans">
            {card.noteType === "DIRECT_QUOTE" ? (
              <blockquote
                className={cn(
                  "relative pl-3 text-sm leading-relaxed text-foreground border-l-2",
                  noteConfig.borderAccent,
                )}
              >
                &ldquo;{card.content}&rdquo;
              </blockquote>
            ) : (
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {card.content}
              </p>
            )}
          </div>
        </div>

        {/* Section 3: Researcher's Annotation / Comment */}
        {card.comment && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <MessageSquareQuote className="h-3.5 w-3.5 text-primary" />
              Araştırmacı Şerhi & Kişisel Not
            </h4>
            <div className="p-3 rounded-md border border-border/60 bg-muted/20 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {card.comment}
            </div>
          </div>
        )}

        {/* Section 4: Source & Box Origin Details */}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            Kaynak Bilgileri
          </h4>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-md bg-muted/20 border border-border/40 flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Eser Başlığı
              </span>
              <span className="font-medium text-foreground line-clamp-2" title={card.sourceTitle}>
                {card.sourceTitle}
              </span>
            </div>

            <div className="p-2.5 rounded-md bg-muted/20 border border-border/40 flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Yazar & Yıl
              </span>
              <span className="font-medium text-foreground truncate">
                {card.sourceAuthors.join(", ") || "Belirtilmemiş"} ({card.sourceYear})
              </span>
            </div>

            <div className="p-2.5 rounded-md bg-muted/20 border border-border/40 flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Sayfa Numarası
              </span>
              <span className="font-mono font-medium text-foreground">
                {formattedPage}
              </span>
            </div>

            <div className="p-2.5 rounded-md bg-muted/20 border border-border/40 flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Tematik Kutu (Menşe)
              </span>
              <span className="font-medium text-foreground truncate flex items-center gap-1">
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", boxConfig.dotClassName)} />
                {card.boxTitle}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Action Buttons */}
      <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(card.id)}
          className="gap-1 text-xs h-8"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Sil</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(card)}
            className="gap-1 text-xs h-8"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Düzenle</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
