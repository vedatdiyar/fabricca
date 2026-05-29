import React from "react";
import { FolderClosed, X } from "lucide-react";
import { Note, ThesisBox } from "../types";
import { ThematicBoxDialogNoteCard } from "./thematic-box-dialog-note-card";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

interface ThematicBoxDialogContentProps {
  box: ThesisBox;
  boxNotes: Note[];
  onEditNote: (note: Note) => void;
}

export function ThematicBoxDialogContent({
  box,
  boxNotes,
  onEditNote,
}: ThematicBoxDialogContentProps) {
  return (
    <DialogContent className="max-w-[95vw] sm:max-w-4xl lg:max-w-6xl max-h-[90vh] overflow-y-auto bg-card border border-border p-6 flex flex-col font-sans">
      <DialogHeader className="border-b border-border pb-4 mb-4">
        <div className="flex items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <FolderClosed className="size-5 text-primary shrink-0" />
            {box.name}
          </DialogTitle>
          <DialogClose
            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1"
            aria-label="Kapat"
          >
            <X className="size-5" />
          </DialogClose>
        </div>
      </DialogHeader>

      {box.description && (
        <div className="bg-secondary border border-border rounded-lg p-4 text-sm text-foreground leading-relaxed font-sans whitespace-pre-wrap mb-4">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            Kutu Açıklaması
          </span>
          {box.description}
        </div>
      )}

      <div className="border-t border-border pt-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <span>Bağlı Fişler</span>
          <span className="text-xs font-mono font-bold bg-secondary border border-border text-primary px-2 py-0.5 rounded">
            {boxNotes.length} Kart
          </span>
        </h4>

        {boxNotes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-8">
            Bu kutuya henüz fiş eklenmemiş.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {boxNotes.map((note) => (
              <ThematicBoxDialogNoteCard
                key={note.id}
                note={note}
                onEditNote={onEditNote}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2 border-t border-border mt-2">
        <DialogClose className="text-xs px-4 py-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-colors mt-3">
          Kapat
        </DialogClose>
      </div>
    </DialogContent>
  );
}
