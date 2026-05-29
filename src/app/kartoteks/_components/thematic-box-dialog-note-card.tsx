import React from "react";
import { Maximize2, FileText, Quote } from "lucide-react";
import { Note } from "../types";
import { parseQuotes } from "./markdown-renderers";

interface ThematicBoxDialogNoteCardProps {
  note: Note;
  onEditNote: (note: Note) => void;
}

export function ThematicBoxDialogNoteCard({
  note,
  onEditNote,
}: ThematicBoxDialogNoteCardProps) {
  const quoteCount = parseQuotes(note.quotes).filter((q) =>
    q.text.trim(),
  ).length;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onEditNote(note);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEditNote(note);
        }
      }}
      className="group border rounded-lg p-4 space-y-3 cursor-pointer transition-all duration-150 relative overflow-hidden flex flex-col justify-between hover:border-primary hover:bg-secondary border-border bg-card shadow-sm"
    >
      <div className="space-y-3">
        {/* Bütünleşik Akademik Künye */}
        <div className="text-xs leading-relaxed font-sans text-muted-foreground border-b border-border pb-2.5 flex justify-between items-start gap-4">
          <div className="min-w-0">
            <span className="font-bold text-primary mr-1.5">
              {note.referenceAuthors || "Yazar Yok"}
            </span>
            <span className="text-foreground font-mono mr-1.5">
              ({note.referenceYear || "Yıl Yok"})
            </span>
            {note.referenceTitle && (
              <span className="text-foreground font-medium italic block sm:inline mt-0.5 sm:mt-0 leading-normal">
                — {note.referenceTitle}
              </span>
            )}
          </div>
          <span className="text-xs font-mono text-muted-foreground flex items-center gap-1 shrink-0 mt-0.5">
            Fiş #{note.id}
            <Maximize2 className="size-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </span>
        </div>

        {/* Fiş İçerik Göstergeleri */}
        <div className="space-y-2">
          {note.mainArgument && (
            <div className="text-xs text-foreground bg-secondary border border-border p-2 rounded">
              <span className="text-primary font-bold flex items-center gap-1 mb-0.5">
                <FileText className="size-3" />
                <span>Ana Argüman:</span>
              </span>
              <p className="line-clamp-2 text-muted-foreground leading-relaxed font-sans">
                {note.mainArgument}
              </p>
            </div>
          )}

          {quoteCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans bg-secondary border border-border p-2 rounded">
              <Quote className="size-3 text-primary" />
              <span>
                <strong className="text-foreground">{quoteCount}</strong> adet
                doğrudan alıntı kayıtlı
              </span>
            </div>
          )}

          {!note.mainArgument && quoteCount === 0 && (
            <div className="text-xs text-foreground line-clamp-3 leading-relaxed font-sans">
              {note.content}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2 mt-1">
        <span className="text-xs font-sans text-primary font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform duration-150">
          Düzenle →
        </span>
      </div>
    </div>
  );
}
