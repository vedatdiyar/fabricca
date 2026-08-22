"use client";

import { useEffect, useState } from "react";
import {
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getNoteTypeBadgeConfig } from "./citation-card";
import { createFlowId, Logger } from "@/lib/logger";
import { getBoxTypeBadgeConfig } from "@/lib/box-constants";
import { formatPageNumber } from "@/lib/academic/utils";
import { InspectorHeader } from "./inspector/inspector-header";
import { InspectorOutlineSection } from "./inspector/inspector-outline-section";
import { InspectorQuoteSection } from "./inspector/inspector-quote-section";
import { InspectorSourceSection } from "./inspector/inspector-source-section";
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
      new Logger(createFlowId()).error("handleOutlineChange error:", {
        service: "citation-cards",
        error: err,
      });
      toast.error("Bölüm bağı güncellenirken bir hata oluştu.");
    } finally {
      setIsUpdatingOutline(false);
    }
  };

  return (
    <div className="w-full lg:w-[400px] shrink-0 border-l border-border bg-card flex flex-col h-full overflow-y-auto animate-in slide-in-from-right-4 duration-200">
      {/* Header Bar */}
      <InspectorHeader
        noteConfig={noteConfig}
        onClose={onClose}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />

      {/* Main Content Body */}
      <div className="p-4 space-y-5 flex-1 text-sm">
        <InspectorOutlineSection
          currentOutlineId={currentOutlineId}
          outlines={outlines}
          isUpdatingOutline={isUpdatingOutline}
          onOutlineChange={handleOutlineChange}
        />

        <InspectorQuoteSection
          card={card}
          noteConfig={noteConfig}
          copied={copied}
          onCopy={handleCopy}
        />

        <InspectorSourceSection
          card={card}
          formattedPage={formattedPage}
          boxConfig={boxConfig}
        />
      </div>

      {/* Footer Action Buttons */}
      <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(card.id)}
          className="gap-1 text-xs h-8 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Sil</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(card)}
            className="gap-1 text-xs h-8 cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Düzenle</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
