"use client";

import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNoteTypeBadgeConfig } from "../citation-card";

interface InspectorHeaderProps {
  noteConfig: ReturnType<typeof getNoteTypeBadgeConfig>;
  onClose: () => void;
  onPrevCard?: () => void;
  onNextCard?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function InspectorHeader({
  noteConfig,
  onClose,
  onPrevCard,
  onNextCard,
  hasPrev,
  hasNext,
}: InspectorHeaderProps) {
  const NoteIcon = noteConfig.icon;

  return (
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
            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
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
            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Sonraki Fiş (→)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 text-muted-foreground hover:text-foreground ml-1 cursor-pointer"
          title="Paneli Kapat (Esc)"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
