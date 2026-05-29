"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Note, ThesisBox } from "../types";
import { ThematicBoxCard } from "./thematic-box-card";

interface ThematicBoxesGridProps {
  boxes: ThesisBox[];
  notes: Note[];
  overBoxId: number | null;
  draggedNoteId: number | null;
  transferringNoteId: number | null;
  onDragEnterBox: (e: React.DragEvent, boxId: number) => void;
  onDragLeaveBox: () => void;
  onDropBox: (e: React.DragEvent, boxId: number) => void;
  onDragStartNote: (e: React.DragEvent, noteId: number) => void;
  onDragEndNote: () => void;
  onTransferNote: (noteId: number, boxId: number | null) => void;
  onEditNote: (note: Note) => void;
}

export function ThematicBoxesGrid({
  boxes,
  notes,
  overBoxId,
  draggedNoteId,
  transferringNoteId,
  onDragEnterBox,
  onDragLeaveBox,
  onDropBox,
  onDragStartNote,
  onDragEndNote,
  onTransferNote,
  onEditNote,
}: ThematicBoxesGridProps) {
  const [dialogBoxId, setDialogBoxId] = useState<number | null>(null);

  return (
    <div className="lg:col-span-2 border border-border bg-card p-6 rounded-lg shadow-xl flex flex-col space-y-6 min-h-[400px]">
      <div className="border-b border-border pb-3 flex justify-between items-center">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span>Tematik Bilgi Kutuları</span>
        </h2>
        <span className="text-xs font-mono font-bold bg-secondary border border-border text-primary px-2 py-0.5 rounded">
          {boxes.length} Kutu
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-normal font-sans">
        Onboarding mülakatında belirlediğiniz tezin temel kavramsal direkleri.
        Kutuların üzerine tıklayarak içindeki kartları görebilir, kartları
        sürükleyip bırakarak kutular arasında tasnif edebilir veya kartın üstüne
        tıklayarak form alanlarını düzenleyebilirsiniz.
      </p>

      {boxes.length === 0 ? (
        <div className="flex-1 border border-dashed border-border rounded-lg flex flex-col items-center justify-center p-12 text-center text-xs text-muted-foreground bg-background italic">
          Henüz tanımlanmış bir tematik çalışma kutusu bulunamadı. Lütfen
          onboarding mülakatını tamamlayın.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {boxes.map((box) => {
            const boxNotes = notes.filter((note) => note.boxId === box.id);
            return (
              <ThematicBoxCard
                key={box.id}
                box={box}
                boxNotes={boxNotes}
                overBoxId={overBoxId}
                draggedNoteId={draggedNoteId}
                transferringNoteId={transferringNoteId}
                dialogBoxId={dialogBoxId}
                setDialogBoxId={setDialogBoxId}
                onDragEnterBox={onDragEnterBox}
                onDragLeaveBox={onDragLeaveBox}
                onDropBox={onDropBox}
                onDragStartNote={onDragStartNote}
                onDragEndNote={onDragEndNote}
                onTransferNote={onTransferNote}
                onEditNote={onEditNote}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
