"use client";

import React, { useState } from "react";
import {
  FileText,
  Sparkles,
  Loader2,
  Pencil,
  Quote,
  Tags,
  AlertCircle,
  Link2,
  Compass,
  Brain,
  RotateCw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { retriggerAiAnalysisAction } from "../actions";

const inlineMarkdownComponents: Components = {
  h1: ({ children }: React.ComponentPropsWithoutRef<"h1">) => (
    <span className="block font-bold text-primary text-[10px] uppercase tracking-wider mt-2.5 mb-0.5 font-sans">
      {children}
    </span>
  ),
  h2: ({ children }: React.ComponentPropsWithoutRef<"h2">) => (
    <span className="block font-bold text-primary text-[10px] uppercase tracking-wider mt-2 mb-0.5 font-sans">
      {children}
    </span>
  ),
  h3: ({ children }: React.ComponentPropsWithoutRef<"h3">) => (
    <span className="block font-bold text-primary text-[10px] uppercase tracking-wider mt-1.5 mb-0.5 font-sans">
      {children}
    </span>
  ),
  h4: ({ children }: React.ComponentPropsWithoutRef<"h4">) => (
    <span className="block font-bold text-primary text-[10px] uppercase tracking-wider mt-1.5 mb-0.5 font-sans">
      {children}
    </span>
  ),
  p: ({ children }: React.ComponentPropsWithoutRef<"p">) => (
    <span className="block font-sans text-foreground leading-relaxed mb-1.5 last:mb-0">
      {children}
    </span>
  ),
};

interface Note {
  id: number;
  referenceId: number | null;
  content: string;
  aiContextSuggestions: string | null;
  isUserNote: boolean | null;
  boxId: number | null;
  mainArgument?: string | null;
  quotes?: string | null;
  concepts?: string | null;
  criticalNotes?: string | null;
  connections?: string | null;
  researchNotes?: string | null;
  memoryAnchors?: string | null;
  createdAt: Date | null;
}

interface Box {
  id: number;
  name: string;
  description: string | null;
}

interface NotesListProps {
  displayedNotes: Note[];
  isSavingNote: boolean;
  filterByBox: boolean;
  setFilterByBox: (filter: boolean) => void;
  selectedBoxId: number | null;
  boxes: Box[];
  startEditingNote: (note: Note) => void;
  onNoteSaved?: () => Promise<void>;
}

export function NotesList({
  displayedNotes,
  isSavingNote,
  filterByBox,
  setFilterByBox,
  selectedBoxId,
  boxes,
  startEditingNote,
  onNoteSaved,
}: NotesListProps) {
  const [analyzingNoteId, setAnalyzingNoteId] = useState<number | null>(null);

  const handleRetriggerAi = async (noteId: number) => {
    setAnalyzingNoteId(noteId);
    try {
      const res = await retriggerAiAnalysisAction(noteId);
      if (res.success) {
        if (onNoteSaved) {
          await onNoteSaved();
        }
      } else {
        console.error(
          res.error || "Yapay zeka analizi yenilenirken bir hata oluştu.",
        );
      }
    } catch (err) {
      console.error(
        "Yapay zeka analizi sırasında beklenmeyen bir hata oluştu:",
        err,
      );
    } finally {
      setAnalyzingNoteId(null);
    }
  };

  return (
    <div className="border-t border-border pt-6 flex flex-col space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <span>Kayıtlı Okuma Notları ({displayedNotes.length})</span>
        </h3>

        {/* Tasnif Filtreleme */}
        {selectedBoxId !== null && (
          <button
            onClick={() => setFilterByBox(!filterByBox)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition cursor-pointer ${
              filterByBox
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Sadece Seçili Kumbarayı Göster</span>
          </button>
        )}
      </div>

      {displayedNotes.length === 0 && !isSavingNote ? (
        <div className="border border-border rounded flex items-center justify-center text-xs text-muted-foreground bg-background p-6 text-center italic">
          {filterByBox
            ? "Seçilen entelektüel kumbaraya ait kayıtlı okuma notu bulunmuyor."
            : "Bu makaleye ait henüz kayıtlı okuma notu bulunmuyor."}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Glowing AI Loading Placeholder card when isSavingNote is true */}
          {isSavingNote && (
            <div className="p-4 bg-background border border-primary rounded-lg text-sm flex flex-col space-y-3 animate-pulse relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <p className="text-foreground leading-relaxed whitespace-pre-wrap italic opacity-80 font-sans text-xs">
                Yeni akademik kartoteks kaydı işleniyor ve vektör embedding
                hesaplanıyor...
              </p>

              <div className="bg-card border border-primary p-4 rounded mt-2 space-y-3 relative">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-bl">
                  Akademik İçgörü
                </div>
                <h4 className="text-xs font-bold text-primary flex items-center gap-2">
                  <Sparkles className="size-3.5 animate-spin" />
                  <span>Akademik Bağlam ve Atıf Analizi Yapılıyor...</span>
                </h4>
                <div className="text-xs text-muted-foreground flex items-center space-x-2">
                  <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                  <span>
                    Gemini 3.1 Flash Lite tezinize entegrasyon yollarını
                    çiziyor...
                  </span>
                </div>
              </div>
            </div>
          )}

          {displayedNotes.map((note) => (
            <NoteListCard
              key={note.id}
              note={note}
              boxes={boxes}
              analyzingNoteId={analyzingNoteId}
              handleRetriggerAi={handleRetriggerAi}
              startEditingNote={startEditingNote}
              inlineMarkdownComponents={inlineMarkdownComponents}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteListCard({
  note,
  boxes,
  analyzingNoteId,
  handleRetriggerAi,
  startEditingNote,
  inlineMarkdownComponents,
}: {
  note: Note;
  boxes: Box[];
  analyzingNoteId: number | null;
  handleRetriggerAi: (id: number) => Promise<void>;
  startEditingNote: (note: Note) => void;
  inlineMarkdownComponents: Components;
}) {
  const hasStructuredDetails = !!(
    note.mainArgument ||
    note.quotes ||
    note.concepts ||
    note.criticalNotes ||
    note.connections ||
    note.researchNotes ||
    note.memoryAnchors
  );

  return (
    <div className="p-4 bg-background border border-border rounded-lg text-sm flex flex-col space-y-2 hover:border-primary transition duration-150">
      {/* Header actions for note */}
      <div className="flex justify-between items-center border-b border-border pb-2 mb-1">
        <span className="text-[9px] text-muted-foreground font-mono">
          Kartoteks Fişi #{note.id}
        </span>
        <button
          type="button"
          onClick={() => startEditingNote(note)}
          className="text-muted-foreground hover:text-primary transition-colors cursor-pointer p-1 rounded hover:bg-card border border-transparent hover:border-border"
          title="Notu Düzenle"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {!hasStructuredDetails && (
        <div className="prose prose-invert max-w-none text-xs text-foreground leading-relaxed font-sans">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={inlineMarkdownComponents}
          >
            {note.content}
          </ReactMarkdown>
        </div>
      )}

      {/* Structured Fields Details */}
      {hasStructuredDetails && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="w-full bg-card border border-border rounded-lg p-3 shadow-sm space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-border pb-2">
              <Brain className="size-3.5 text-primary shrink-0" />
              <span>Yapılandırılmış Kartoteks Detayları</span>
            </div>
            <div className="space-y-2.5">
              {note.mainArgument && (
                <div className="text-[11px] text-muted-foreground bg-card p-2.5 rounded border border-border">
                  <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                    <FileText className="size-3 text-primary" />
                    <span>Ana Argüman (Tez):</span>
                  </span>
                  <div className="prose prose-invert max-w-none text-xs text-foreground leading-relaxed font-sans">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={inlineMarkdownComponents}
                    >
                      {note.mainArgument}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              {note.quotes && (
                <div className="text-[11px] text-muted-foreground bg-card p-2.5 rounded border border-border">
                  <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                    <Quote className="size-3 text-primary" />
                    <span>Önemli Alıntılar:</span>
                  </span>
                  <div className="prose prose-invert max-w-none text-xs text-foreground leading-relaxed font-sans">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={inlineMarkdownComponents}
                    >
                      {note.quotes}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              {note.concepts && (
                <div className="text-[11px] text-muted-foreground bg-card p-2.5 rounded border border-border">
                  <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                    <Tags className="size-3 text-primary" />
                    <span>Kavramlar ve Temalar:</span>
                  </span>
                  <div className="prose prose-invert max-w-none text-xs text-foreground leading-relaxed font-sans">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={inlineMarkdownComponents}
                    >
                      {note.concepts}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              {note.criticalNotes && (
                <div className="text-[11px] text-muted-foreground bg-card p-2.5 rounded border border-border">
                  <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                    <AlertCircle className="size-3 text-primary" />
                    <span>Eleştirel Not:</span>
                  </span>
                  <div className="prose prose-invert max-w-none text-xs text-foreground leading-relaxed font-sans">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={inlineMarkdownComponents}
                    >
                      {note.criticalNotes}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              {note.connections && (
                <div className="text-[11px] text-muted-foreground bg-card p-2.5 rounded border border-border">
                  <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                    <Link2 className="size-3 text-primary" />
                    <span>Diğer Metinlerle Bağlantı:</span>
                  </span>
                  <div className="prose prose-invert max-w-none text-xs text-foreground leading-relaxed font-sans">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={inlineMarkdownComponents}
                    >
                      {note.connections}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              {note.researchNotes && (
                <div className="text-[11px] text-muted-foreground bg-card p-2.5 rounded border border-border">
                  <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                    <Compass className="size-3 text-primary" />
                    <span>Araştırmam İçin Not:</span>
                  </span>
                  <div className="prose prose-invert max-w-none text-xs text-foreground leading-relaxed font-sans">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={inlineMarkdownComponents}
                    >
                      {note.researchNotes}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              {note.memoryAnchors && (
                <div className="text-[11px] text-muted-foreground bg-card p-2.5 rounded border border-border">
                  <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                    <Brain className="size-3 text-primary" />
                    <span>Hafıza Notu:</span>
                  </span>
                  <div className="prose prose-invert max-w-none text-xs text-foreground leading-relaxed font-sans">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={inlineMarkdownComponents}
                    >
                      {note.memoryAnchors}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {note.boxId && (
        <div className="flex items-center gap-1.5 self-start pt-1">
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary text-primary-foreground border border-primary">
            Kumbara:{" "}
            {boxes.find((b) => b.id === note.boxId)?.name || "Bilinmeyen Bölüm"}
          </span>
        </div>
      )}

      <span className="text-[9px] text-muted-foreground font-mono self-end">
        {note.createdAt ? new Date(note.createdAt).toLocaleString("tr-TR") : ""}
      </span>

      {note.aiContextSuggestions && (
        <div className="bg-card border border-primary p-4 rounded mt-2 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-bl">
            Akademik İçgörü
          </div>
          <h4 className="text-xs font-bold text-primary flex items-center gap-2">
            <Sparkles className="size-3.5" />
            <span>AI Entegrasyon Önerisi & Künye</span>
          </h4>
          <div className="text-xs text-muted-foreground leading-relaxed font-sans prose prose-invert max-w-none [&_p]:my-0.5">
            {analyzingNoteId === note.id ? (
              <div className="flex items-center gap-2 text-primary font-semibold py-1">
                <Loader2 className="size-4 animate-spin shrink-0" />
                <span>Semantik bağlantılar analiz ediliyor...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={inlineMarkdownComponents}
                >
                  {note.aiContextSuggestions}
                </ReactMarkdown>

                {/* Retrigger button below the suggestions */}
                <div className="flex justify-end pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => handleRetriggerAi(note.id)}
                    disabled={analyzingNoteId !== null}
                    className="px-2.5 py-1 bg-secondary text-foreground border border-border text-[10px] font-bold uppercase tracking-wider rounded hover:bg-background disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <RotateCw className="size-3 shrink-0" />
                    <span>Yeniden Analiz Et</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
