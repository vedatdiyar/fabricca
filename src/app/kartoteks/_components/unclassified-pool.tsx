import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { HelpCircle, Maximize2, FileText, Quote, Brain } from "lucide-react";
import { Note, ThesisBox } from "../types";
import { parseQuotes, inlineMarkdownComponents } from "./markdown-renderers";

interface UnclassifiedPoolProps {
  unclassifiedNotes: Note[];
  boxes: ThesisBox[];
  transferringNoteId: number | null;
  draggedNoteId: number | null;
  isLeftPoolOver: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, noteId: number) => void;
  onDragEnd: () => void;
  onTransferNote: (noteId: number, boxId: number | null) => void;
  onEditNote: (note: Note) => void;
}

export function UnclassifiedPool({
  unclassifiedNotes,
  boxes: _boxes,
  transferringNoteId: _transferringNoteId,
  draggedNoteId,
  isLeftPoolOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onTransferNote: _onTransferNote,
  onEditNote,
}: UnclassifiedPoolProps) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`lg:col-span-1 border p-6 rounded-lg shadow-xl flex flex-col space-y-6 min-h-[400px] transition-all duration-200 ${
        isLeftPoolOver ? "border-primary bg-secondary" : "border-border bg-card"
      }`}
    >
      <div className="border-b border-border pb-3 flex justify-between items-center">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <HelpCircle className="size-4 text-primary" />
          <span>Tasnifsiz Fiş Havuzu</span>
        </h2>
        <span className="text-xs font-mono font-bold bg-secondary border border-border text-primary px-2 py-0.5 rounded">
          {unclassifiedNotes.length} Kart
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-normal font-sans">
        Kütüphanede okuma yaparken aldığınız ve henüz hiçbir tematik kutuya
        bağlamadığınız ham fişler. Kartın üzerine tıklayarak yapılandırılmış
        form alanlarını düzenleyebilir veya sürükleyerek kutulara
        yerleştirebilirsiniz.
      </p>

      {unclassifiedNotes.length === 0 ? (
        <div className="flex-1 border border-dashed border-border rounded-lg flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground bg-background italic">
          Tasnif edilmemiş kart bulunmuyor. Kütüphaneden yeni notlar alabilir ya
          da kutulardaki kartları buraya geri çekebilirsiniz.
        </div>
      ) : (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {unclassifiedNotes.map((note) => {
            const quoteCount = parseQuotes(note.quotes).filter((q) =>
              q.text.trim(),
            ).length;

            return (
              <div
                key={note.id}
                draggable={true}
                onDragStart={(e) => onDragStart(e, note.id)}
                onDragEnd={onDragEnd}
                onClick={() => onEditNote(note)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEditNote(note);
                  }
                }}
                className={`group border rounded-lg p-4 space-y-3 relative overflow-hidden transition-all duration-150 cursor-grab active:cursor-grabbing hover:border-primary hover:bg-secondary border-border bg-card ${
                  draggedNoteId === note.id ? "opacity-50 border-primary" : ""
                }`}
              >
                {/* Bütünleşik Akademik Künye (Metadata) */}
                <div className="text-xs leading-relaxed font-sans text-muted-foreground border-b border-border pb-2.5 flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <span className="font-bold text-primary mr-1.5">
                      {note.referenceAuthors || "Bilinmeyen Yazar"}
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
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <span className="text-xs font-mono text-muted-foreground">
                      Fiş #{note.id}
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      title="Fişi düzenle"
                      aria-label="Fişi düzenle"
                    >
                      <Maximize2 className="size-3" />
                    </button>
                  </div>
                </div>

                {/* Fiş İçeriği ve Yapısal Alan Göstergeleri */}
                <div className="space-y-2">
                  {note.mainArgument && (
                    <div className="text-xs text-foreground bg-secondary border border-border p-2 rounded">
                      <span className="text-primary font-bold flex items-center gap-1 mb-0.5">
                        <FileText className="size-3" />
                        <span>Ana Argüman:</span>
                      </span>
                      <p className="line-clamp-2 text-muted-foreground font-sans leading-relaxed">
                        {note.mainArgument}
                      </p>
                    </div>
                  )}

                  {quoteCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans bg-secondary border border-border p-2 rounded">
                      <Quote className="size-3 text-primary" />
                      <span>
                        <strong className="text-foreground">
                          {quoteCount}
                        </strong>{" "}
                        adet doğrudan alıntı kayıtlı
                      </span>
                    </div>
                  )}

                  {note.researchNotes && (
                    <div className="text-xs text-foreground bg-secondary border border-border p-2 rounded">
                      <span className="text-primary font-bold flex items-center gap-1 mb-0.5">
                        <Brain className="size-3" />
                        <span>Tez İlişkisi & Gap:</span>
                      </span>
                      <p className="line-clamp-2 text-muted-foreground font-sans leading-relaxed">
                        {note.researchNotes}
                      </p>
                    </div>
                  )}

                  {!note.mainArgument &&
                    !note.researchNotes &&
                    quoteCount === 0 && (
                      <div className="prose prose-invert max-w-none text-xs text-foreground leading-relaxed font-sans line-clamp-4 pt-1">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={inlineMarkdownComponents}
                        >
                          {note.content}
                        </ReactMarkdown>
                      </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
