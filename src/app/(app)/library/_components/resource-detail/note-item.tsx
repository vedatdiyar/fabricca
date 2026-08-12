"use client";

import React from "react";
import { BookmarkCheck, MessageSquareQuote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LibraryResourceNote, NoteType } from "../../_lib/types";

interface NoteItemProps {
  note: LibraryResourceNote;
  onDeleteNoteClick: (noteId: number) => void;
}

/**
 * Returns badge label and className for a given note type.
 *
 * @param noteType - Type of the note.
 * @returns Badge configuration with label and className.
 */
export function getNoteTypeBadgeConfig(noteType: NoteType) {
  switch (noteType) {
    case "DIRECT_QUOTE":
      return {
        label: "Doğrudan Alıntı",
        className: "bg-success/10 text-success border-success/20",
      };
    case "PARAPHRASE":
      return {
        label: "Dolaylı Alıntı",
        className: "bg-warning/10 text-warning border-warning/20",
      };
    case "PERSONAL_NOTE":
      return {
        label: "Kişisel Not",
        className: "bg-info/10 text-info border-info/20",
      };
  }
}

/**
 * Renders an individual note or citation card.
 *
 * @param root0 - Component props.
 * @param root0.note - Note item to display.
 * @param root0.onDeleteNoteClick - Callback triggered when the delete button is clicked.
 * @returns The note item markup.
 */
export function NoteItem({ note, onDeleteNoteClick }: NoteItemProps) {
  const noteBadge = getNoteTypeBadgeConfig(note.noteType);

  return (
    <Card className="border border-border bg-background transition-all hover:border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="font-mono text-xs font-semibold bg-muted text-foreground border border-border/40"
            >
              {note.pageNumber}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] font-medium ${noteBadge.className}`}
            >
              {noteBadge.label}
            </Badge>
          </div>

          <span className="flex items-center gap-2 text-[10px] text-success font-medium">
            <BookmarkCheck className="h-3.5 w-3.5" /> {"Alıntı Fişi"}
          </span>
        </div>

        <p className="font-sans text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {note.content}
        </p>

        {note.comment && (
          <div className="flex gap-2 rounded-md border border-border/40 border-l-2 border-l-primary/20 bg-muted/20 px-3 py-2">
            <MessageSquareQuote className="h-3.5 w-3.5 text-primary shrink-0 mt-1" />
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Kişisel Yorum / Şerh
              </p>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {note.comment}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
          <span className="text-[10px] text-muted-foreground font-mono">
            {new Date(note.createdAt).toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteNoteClick(note.id)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
