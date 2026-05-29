import React from "react";
import { FolderClosed, FolderMinus } from "lucide-react";
import { Note, ThesisBox } from "../types";
import { ThematicBoxDialogContent } from "./thematic-box-dialog-content";
import { Dialog } from "@/components/ui/dialog";

interface ThematicBoxCardProps {
  box: ThesisBox;
  boxNotes: Note[];
  overBoxId: number | null;
  draggedNoteId: number | null;
  transferringNoteId: number | null;
  dialogBoxId: number | null;
  setDialogBoxId: React.Dispatch<React.SetStateAction<number | null>>;
  onDragEnterBox: (e: React.DragEvent, boxId: number) => void;
  onDragLeaveBox: () => void;
  onDropBox: (e: React.DragEvent, boxId: number) => void;
  onDragStartNote: (e: React.DragEvent, noteId: number) => void;
  onDragEndNote: () => void;
  onTransferNote: (noteId: number, boxId: number | null) => void;
  onEditNote: (note: Note) => void;
}

export function ThematicBoxCard({
  box,
  boxNotes,
  overBoxId,
  draggedNoteId,
  transferringNoteId,
  dialogBoxId,
  setDialogBoxId,
  onDragEnterBox,
  onDragLeaveBox,
  onDropBox,
  onDragStartNote,
  onDragEndNote,
  onTransferNote,
  onEditNote,
}: ThematicBoxCardProps) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => onDragEnterBox(e, box.id)}
      onDragLeave={onDragLeaveBox}
      onDrop={(e) => onDropBox(e, box.id)}
      className={`border p-5 rounded-lg shadow-sm transition duration-200 ${
        overBoxId === box.id
          ? "border-primary bg-secondary"
          : "border-border bg-background"
      }`}
    >
      <Dialog
        open={dialogBoxId === box.id}
        onOpenChange={(open) => {
          if (!open) setDialogBoxId(null);
        }}
      >
        {/* Clickable trigger — tüm kart */}
        <div
          onClick={() => setDialogBoxId(box.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setDialogBoxId(box.id);
            }
          }}
          className="flex flex-col justify-between space-y-4 h-full cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-md"
        >
          {/* Box Header Info */}
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 truncate pr-2">
                <FolderClosed className="size-4 text-primary shrink-0" />
                <span className="truncate">{box.name}</span>
              </h3>
              <span className="text-xs font-mono font-bold bg-secondary border border-border text-muted-foreground px-2 py-0.5 rounded shrink-0">
                {boxNotes.length} Kart
              </span>
            </div>
            {box.description && (
              <p className="text-xs text-muted-foreground leading-normal font-sans line-clamp-2 break-words">
                {box.description}
              </p>
            )}
          </div>

          {/* Classified Notes Preview */}
          <div className="flex-1 flex flex-col pt-3 border-t border-border space-y-3 min-h-[150px]">
            {boxNotes.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded bg-card p-4 text-center font-sans">
                Kutu boş. Sol sütundan fiş yerleştirin.
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {boxNotes.map((note) => (
                  <div
                    key={note.id}
                    draggable={true}
                    onDragStart={(e) => onDragStartNote(e, note.id)}
                    onDragEnd={onDragEndNote}
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
                    className={`border p-3 rounded-lg space-y-2.5 relative group transition-all duration-150 cursor-grab active:cursor-grabbing hover:border-primary border-border bg-card ${
                      draggedNoteId === note.id
                        ? "opacity-50 border-primary"
                        : ""
                    }`}
                  >
                    {/* Bütünleşik Akademik Künye */}
                    <div className="text-xs leading-relaxed font-sans text-muted-foreground border-b border-border pb-1.5 flex justify-between items-start gap-3">
                      <div className="min-w-0 truncate">
                        <span className="font-bold text-primary mr-1">
                          {note.referenceAuthors || "Yazar Yok"}
                        </span>
                        <span className="text-foreground font-mono mr-1">
                          ({note.referenceYear || "Yıl Yok"})
                        </span>
                        {note.referenceTitle && (
                          <span className="text-foreground italic font-medium">
                            — {note.referenceTitle}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        <span className="text-xs font-mono text-muted-foreground">
                          #{note.id}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTransferNote(note.id, box.id);
                          }}
                          disabled={transferringNoteId === note.id}
                          className="text-muted-foreground hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                          title="Tasnifsiz Havuzuna Çıkar"
                          aria-label="Tasnifsiz havuzuna çıkar"
                        >
                          <FolderMinus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-foreground font-sans leading-relaxed truncate">
                      {note.mainArgument || note.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Full Box Dialog - Extracted to ThematicBoxDialogContent */}
        <ThematicBoxDialogContent
          box={box}
          boxNotes={boxNotes}
          onEditNote={onEditNote}
        />
      </Dialog>
    </div>
  );
}
