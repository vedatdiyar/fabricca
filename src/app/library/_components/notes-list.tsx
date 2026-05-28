"use client";

import React from "react";
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
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ReactMarkdown from "react-markdown";

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
}

export function NotesList({
  displayedNotes,
  isSavingNote,
  filterByBox,
  setFilterByBox,
  selectedBoxId,
  boxes,
  startEditingNote,
}: NotesListProps) {
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
                ? "bg-primary/15 border-primary/40 text-primary"
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
            <div
              key={note.id}
              className="p-4 bg-background border border-border rounded-lg text-sm flex flex-col space-y-2 hover:border-border/50 transition duration-150"
            >
              {/* Header actions for note */}
              <div className="flex justify-between items-center border-b border-border/40 pb-2 mb-1">
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

              <p className="text-foreground leading-relaxed whitespace-pre-wrap font-sans text-xs">
                {note.content}
              </p>

              {/* Structured Fields Details Accordion */}
              <div className="mt-3 pt-3 border-t border-border/40">
                <Accordion className="w-full">
                  <AccordionItem value="details" className="border-none">
                    <AccordionTrigger className="text-[10px] text-primary hover:text-primary/80 py-1 font-semibold flex justify-between items-center hover:no-underline">
                      Yapılandırılmış Kartoteks Detayları
                    </AccordionTrigger>
                    <AccordionContent className="pt-2.5 space-y-2 pb-0">
                      {note.mainArgument && (
                        <div className="text-[11px] text-muted-foreground bg-card/50 p-2.5 rounded border border-border/60">
                          <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                            <FileText className="size-3 text-primary" />
                            <span>Ana Argüman (Tez):</span>
                          </span>
                          <p className="leading-relaxed font-sans">
                            {note.mainArgument}
                          </p>
                        </div>
                      )}
                      {note.quotes && (
                        <div className="text-[11px] text-muted-foreground bg-card/50 p-2.5 rounded border border-border/60">
                          <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                            <Quote className="size-3 text-primary" />
                            <span>Önemli Alıntılar:</span>
                          </span>
                          <p className="leading-relaxed font-sans whitespace-pre-wrap">
                            {note.quotes}
                          </p>
                        </div>
                      )}
                      {note.concepts && (
                        <div className="text-[11px] text-muted-foreground bg-card/50 p-2.5 rounded border border-border/60">
                          <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                            <Tags className="size-3 text-primary" />
                            <span>Kavramlar ve Temalar:</span>
                          </span>
                          <p className="leading-relaxed font-sans">
                            {note.concepts}
                          </p>
                        </div>
                      )}
                      {note.criticalNotes && (
                        <div className="text-[11px] text-muted-foreground bg-card/50 p-2.5 rounded border border-border/60">
                          <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                            <AlertCircle className="size-3 text-primary" />
                            <span>Eleştirel Not:</span>
                          </span>
                          <p className="leading-relaxed font-sans">
                            {note.criticalNotes}
                          </p>
                        </div>
                      )}
                      {note.connections && (
                        <div className="text-[11px] text-muted-foreground bg-card/50 p-2.5 rounded border border-border/60">
                          <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                            <Link2 className="size-3 text-primary" />
                            <span>Diğer Metinlerle Bağlantı:</span>
                          </span>
                          <p className="leading-relaxed font-sans">
                            {note.connections}
                          </p>
                        </div>
                      )}
                      {note.researchNotes && (
                        <div className="text-[11px] text-muted-foreground bg-card/50 p-2.5 rounded border border-border/60">
                          <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                            <Compass className="size-3 text-primary" />
                            <span>Araştırmam İçin Not:</span>
                          </span>
                          <p className="leading-relaxed font-sans">
                            {note.researchNotes}
                          </p>
                        </div>
                      )}
                      {note.memoryAnchors && (
                        <div className="text-[11px] text-muted-foreground bg-card/50 p-2.5 rounded border border-border/60">
                          <span className="text-foreground font-bold flex items-center gap-1 mb-1">
                            <Brain className="size-3 text-primary" />
                            <span>Hafıza Notu:</span>
                          </span>
                          <p className="leading-relaxed font-sans">
                            {note.memoryAnchors}
                          </p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {note.boxId && (
                <div className="flex items-center gap-1.5 self-start pt-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
                    Kumbara:{" "}
                    {boxes.find((b) => b.id === note.boxId)?.name ||
                      "Bilinmeyen Bölüm"}
                  </span>
                </div>
              )}

              <span className="text-[9px] text-muted-foreground font-mono self-end">
                {note.createdAt
                  ? new Date(note.createdAt).toLocaleString("tr-TR")
                  : ""}
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
                  <div className="text-xs text-muted-foreground leading-relaxed font-sans prose prose-invert max-w-none [&_li]:mb-4">
                    <ReactMarkdown>{note.aiContextSuggestions}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
