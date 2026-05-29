"use client";

import React, { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FolderKanban,
  FolderMinus,
  Sparkles,
  Loader2,
  FolderClosed,
  AlertCircle,
  HelpCircle,
  Maximize2,
  Brain,
  FileText,
  Quote,
  X,
  BookOpen,
} from "lucide-react";
import {
  getThesisBoxesAction,
  getAllNotesWithReferencesAction,
  updateNoteBoxAction,
} from "../library/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

interface ThesisBox {
  id: number;
  thesisCoreId: number;
  name: string;
  description: string | null;
  order: number;
  createdAt: Date | null;
}

interface Note {
  id: number;
  referenceId: number | null;
  content: string;
  aiContextSuggestions: string | null;
  boxId: number | null;
  createdAt: Date | null;
  referenceTitle: string | null;
  referenceAuthors: string | null;
  referenceYear: number | null;
  mainArgument?: string | null;
  quotes?: string | null;
  concepts?: string | null;
  criticalNotes?: string | null;
  connections?: string | null;
  researchNotes?: string | null;
  memoryAnchors?: string | null;
}

interface PageState {
  boxes: ThesisBox[];
  notes: Note[];
  isLoading: boolean;
  transferringNoteId: number | null;
  draggedNoteId: number | null;
  isLeftPoolOver: boolean;
  overBoxId: number | null;
  error: string | null;
}

const INITIAL_STATE: PageState = {
  boxes: [],
  notes: [],
  isLoading: true,
  transferringNoteId: null,
  draggedNoteId: null,
  isLeftPoolOver: false,
  overBoxId: null,
  error: null,
};

interface QuotationRow {
  text: string;
  page: string;
}

function cleanPageNumber(pageStr: string): string {
  return pageStr
    .trim()
    .replace(/^(?:sayfa|Sayfa|s\.|s)\s*/i, "")
    .trim();
}

// Parse quotes from database string to array of QuotationRow
function parseQuotes(quotesStr: string | null | undefined): QuotationRow[] {
  if (!quotesStr || !quotesStr.trim()) {
    return [{ text: "", page: "" }];
  }

  const rows: QuotationRow[] = [];
  const lines = quotesStr.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Matches bullet points of type: - s. 45: "some quote text"
    // Or: s. 45: "some quote text"
    // Or: - s. 45: some quote text
    const match =
      trimmed.match(/^(?:-\s*)?s\.\s*([^:]+):\s*"([\s\S]*)"$/) ||
      trimmed.match(/^(?:-\s*)?s\.\s*([^:]+):\s*([\s\S]*)$/);

    if (match) {
      rows.push({
        page: cleanPageNumber(match[1]),
        text: match[2].trim(),
      });
    } else {
      // Fallback for simple list items or plain text that doesn't have page
      const textOnly = trimmed.replace(/^-\s*/, "");
      rows.push({
        page: "",
        text: textOnly,
      });
    }
  }

  return rows.length > 0 ? rows : [{ text: "", page: "" }];
}



const inlineMarkdownComponents = {
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

function KartoteksHeader() {
  return (
    <header className="border-b border-border pb-6 mb-8 flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderKanban className="h-6 w-6 text-primary" />
          <span>Bilgi Fişi Laboratuvarı</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 font-sans">
          Okuma notlarınızı ve atıf fişlerinizi esnek tematik çalışma kutularına
          tasnif edin
        </p>
      </div>
      <span className="text-xs font-mono text-primary bg-card border border-border px-3 py-1 rounded">
        Active Laboratory
      </span>
    </header>
  );
}

interface KartoteksPreviewDialogProps {
  note: Note | null;
  boxes: ThesisBox[];
  isOpen: boolean;
  onClose: () => void;
}

function KartoteksPreviewDialog({
  note,
  boxes,
  isOpen,
  onClose,
}: KartoteksPreviewDialogProps) {
  if (!note) return null;

  const boxName = note.boxId
    ? boxes.find((b) => b.id === note.boxId)?.name
    : null;

  const parsedQuotes = parseQuotes(note.quotes).filter((q) => q.text.trim());

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-card border border-border p-6 flex flex-col font-sans">
        <DialogHeader className="border-b border-border pb-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-primary bg-secondary border border-border px-2 py-0.5 rounded">
                Fiş #{note.id}
              </span>
              <DialogTitle className="text-lg font-bold text-foreground">
                Kartoteks Bilgi Fişi Önizleme
              </DialogTitle>
            </div>
            <DialogClose
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1"
              aria-label="Kapat"
            >
              <X className="size-5" />
            </DialogClose>
          </div>
        </DialogHeader>

        {/* 1. Kaynak Künyesi (Meta Veriler) - En Tepede */}
        <div className="bg-secondary border border-border rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2 mb-2">
            <BookOpen className="size-4 text-primary shrink-0 mt-0.5" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Kaynak Künyesi
            </span>
          </div>
          <div className="text-xs space-y-1.5 pl-6 font-sans">
            <div>
              <span className="text-muted-foreground mr-1.5">Yazar(lar):</span>
              <span className="text-foreground font-bold">
                {note.referenceAuthors || "Bilinmeyen Yazar"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground mr-1.5">Yayın Yılı:</span>
              <span className="text-foreground font-bold font-mono">
                {note.referenceYear || "Belirtilmemiş"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground mr-1.5">
                Döküman/Kitap Başlığı:
              </span>
              <span className="text-foreground italic font-medium">
                {note.referenceTitle || "Başlıksız Kaynak"}
              </span>
            </div>
          </div>
        </div>

        {/* DETAILS LIST - ONLY PREVIEW */}
        <div className="space-y-6 flex-1">
          {/* Tez Outline Seçimi (Tasnif) */}
          <div className="bg-secondary border border-border rounded-lg p-4 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FolderClosed className="size-4 text-primary shrink-0" />
              <span>Tez Outline Seçimi (Tasnif)</span>
            </span>
            <div className="pl-6">
              {boxName ? (
                <span className="inline-flex items-center px-3 py-1 rounded bg-primary/10 border border-primary/20 text-xs font-bold text-primary font-sans">
                  {boxName}
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded bg-background border border-border text-xs font-bold text-muted-foreground font-sans">
                  Tasnif Dışı (Kutu Seçilmedi)
                </span>
              )}
            </div>
          </div>

          {/* Ana Argüman & Temel İzlek Kutusu */}
          {note.mainArgument && (
            <div className="space-y-2 bg-secondary border border-border rounded-lg p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border pb-2">
                <FileText className="size-4 text-primary shrink-0" />
                <span>Ana Argüman & Temel İzlek Kutusu</span>
              </span>
              <div className="pl-6 pt-1 text-xs text-foreground leading-relaxed font-sans prose prose-invert max-w-none whitespace-pre-wrap">
                {note.mainArgument}
              </div>
            </div>
          )}

          {/* Tez İle İlgisi & Gap (Eksiklik) Analizi Kutusu */}
          {note.researchNotes && (
            <div className="space-y-2 bg-secondary border border-border rounded-lg p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border pb-2">
                <Brain className="size-4 text-primary shrink-0" />
                <span>Tez İle İlgisi & Gap (Eksiklik) Analizi Kutusu</span>
              </span>
              <div className="pl-6 pt-1 text-xs text-foreground leading-relaxed font-sans prose prose-invert max-w-none whitespace-pre-wrap">
                {note.researchNotes}
              </div>
            </div>
          )}

          {/* Doğrudan Alıntı İstasyonu */}
          {parsedQuotes.length > 0 && (
            <div className="space-y-3 border-t border-border pt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Quote className="size-4 text-primary shrink-0" />
                <span>Doğrudan Alıntı İstasyonu (Atıf İçin Nokta Atışı)</span>
              </span>

              <div className="space-y-3">
                {parsedQuotes.map((row, index) => (
                  <div
                    key={`quote-${index}-${row.page || "np"}-${row.text.substring(0, 15)}`}
                    className="bg-secondary border border-border rounded-lg p-4 flex flex-col sm:flex-row justify-between gap-3 items-start relative"
                  >
                    <div className="flex-1 text-xs text-foreground font-sans leading-relaxed italic pr-2">
                      “{row.text}”
                    </div>
                    {row.page && (
                      <span className="shrink-0 text-xs font-mono font-bold text-primary bg-background border border-border px-2.5 py-1 rounded self-end sm:self-start">
                        s. {row.page}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Yapay Zeka Analiz ve Semantik Bağlantılar */}
          <div className="bg-secondary border border-border rounded-lg p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-border pb-2">
              <Sparkles className="size-4 shrink-0" />
              <span>Yapay Zeka Analiz ve Semantik Bağlantılar</span>
            </span>
            <div className="pl-6 pt-1 text-xs text-foreground leading-relaxed font-sans prose prose-invert max-w-none">
              {note.aiContextSuggestions ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={inlineMarkdownComponents}
                >
                  {note.aiContextSuggestions}
                </ReactMarkdown>
              ) : (
                <div className="flex items-center gap-2 text-primary font-semibold py-1">
                  <Loader2 className="size-4 animate-spin shrink-0" />
                  <span>Semantik bağlantılar analiz ediliyor...</span>
                </div>
              )}
            </div>
          </div>

          {/* Fallback for raw content if no structured fields are present */}
          {!note.mainArgument &&
            !note.researchNotes &&
            parsedQuotes.length === 0 && (
              <div className="space-y-2 bg-secondary border border-border rounded-lg p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border pb-2">
                  <FileText className="size-4 text-primary shrink-0" />
                  <span>Ham Not İçeriği</span>
                </span>
                <div className="pl-6 pt-1 text-xs text-foreground leading-relaxed font-sans prose prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={inlineMarkdownComponents}
                  >
                    {note.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
        </div>

        {/* DIALOG ACTIONS FOOTER */}
        <div className="border-t border-border pt-4 mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground font-bold cursor-pointer transition-colors"
          >
            Kapat
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

function UnclassifiedPool({
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

function ThematicBoxCard({
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

        {/* Full Box Dialog */}
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
                {boxNotes.map((note) => {
                  const quoteCount = parseQuotes(note.quotes).filter(
                    (q) => q.text.trim(),
                  ).length;

                  return (
                    <div
                      key={note.id}
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
                                <strong className="text-foreground">
                                  {quoteCount}
                                </strong>{" "}
                                adet doğrudan alıntı kayıtlı
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
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-border mt-2">
            <DialogClose className="text-xs px-4 py-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-colors mt-3">
              Kapat
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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

function ThematicBoxesGrid({
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

export default function KartoteksPage() {
  const [pageState, setPageState] = useState<PageState>(INITIAL_STATE);
  const [previewNote, setPreviewNote] = useState<Note | null>(null);

  const loadData = useCallback(async () => {
    setPageState((prev) => ({ ...prev, error: null }));
    try {
      const [boxesRes, notesRes] = await Promise.all([
        getThesisBoxesAction(),
        getAllNotesWithReferencesAction(),
      ]);

      let nextBoxes = INITIAL_STATE.boxes;
      let nextNotes = INITIAL_STATE.notes;

      if (boxesRes.success && boxesRes.boxes) {
        nextBoxes = boxesRes.boxes;
      } else {
        throw new Error(boxesRes.error || "Tematik kutular yüklenemedi.");
      }

      if (notesRes.success && notesRes.notes) {
        nextNotes = notesRes.notes as Note[];
      } else {
        throw new Error(notesRes.error || "Okuma notları yüklenemedi.");
      }

      setPageState((prev) => ({
        ...prev,
        boxes: nextBoxes,
        notes: nextNotes,
        error: null,
      }));
    } catch (err) {
      console.error("Bilgi Fişi load error:", err);
      setPageState((prev) => ({
        ...prev,
        error:
          err instanceof Error
            ? err.message
            : "Veriler yüklenirken bir hata oluştu.",
      }));
    } finally {
      setPageState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    const handle = requestAnimationFrame(() => {
      if (active) {
        loadData();
      }
    });
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [loadData]);

  const handleTransferNote = async (noteId: number, boxId: number | null) => {
    if (pageState.transferringNoteId !== null) return;
    try {
      setPageState((prev) => ({ ...prev, transferringNoteId: noteId }));
      const res = await updateNoteBoxAction(noteId, boxId || 0);
      if (res.success) {
        await loadData();
      } else {
        setPageState((prev) => ({
          ...prev,
          error: res.error || "Not transfer edilirken bir hata oluştu.",
        }));
      }
    } catch (err) {
      console.error("Transfer error:", err);
      setPageState((prev) => ({
        ...prev,
        error: "Not transfer edilirken beklenmeyen bir hata oluştu.",
      }));
    } finally {
      setPageState((prev) => ({ ...prev, transferringNoteId: null }));
    }
  };

  const handleDragEnterLeftPool = (e: React.DragEvent) => {
    e.preventDefault();
    setPageState((prev) => ({ ...prev, isLeftPoolOver: true }));
  };

  const handleDragLeaveLeftPool = () => {
    setPageState((prev) => ({ ...prev, isLeftPoolOver: false }));
  };

  const handleDropLeftPool = async (e: React.DragEvent) => {
    e.preventDefault();
    setPageState((prev) => ({ ...prev, isLeftPoolOver: false }));
    const noteIdStr = e.dataTransfer.getData("noteId");
    if (!noteIdStr) return;
    const noteId = Number(noteIdStr);
    const note = pageState.notes.find((n) => n.id === noteId);
    if (note && note.boxId !== null) {
      await handleTransferNote(noteId, null);
    }
  };

  const handleDragStartNote = (e: React.DragEvent, noteId: number) => {
    e.dataTransfer.setData("noteId", noteId.toString());
    setPageState((prev) => ({ ...prev, draggedNoteId: noteId }));
  };

  const handleDragEndNote = () => {
    setPageState((prev) => ({ ...prev, draggedNoteId: null }));
  };

  const handleDragEnterBox = (e: React.DragEvent, boxId: number) => {
    e.preventDefault();
    setPageState((prev) => ({ ...prev, overBoxId: boxId }));
  };

  const handleDragLeaveBox = () => {
    setPageState((prev) => ({ ...prev, overBoxId: null }));
  };

  const handleDropBox = async (e: React.DragEvent, boxId: number) => {
    e.preventDefault();
    setPageState((prev) => ({ ...prev, overBoxId: null }));
    const noteIdStr = e.dataTransfer.getData("noteId");
    if (!noteIdStr) return;
    const noteId = Number(noteIdStr);
    const note = pageState.notes.find((n) => n.id === noteId);
    if (note && note.boxId !== boxId) {
      await handleTransferNote(noteId, boxId);
    }
  };

  if (pageState.isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] bg-background text-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-sm font-semibold tracking-wide text-muted-foreground animate-pulse">
          Bilgi Fişi Laboratuvarı yükleniyor...
        </p>
      </div>
    );
  }

  const unclassifiedNotes = pageState.notes.filter(
    (note) => note.boxId === null,
  );

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground p-6 md:p-10 font-sans">
      <KartoteksHeader />

      {pageState.error && (
        <Alert
          variant="destructive"
          className="border-destructive bg-destructive text-destructive-foreground mb-6 items-center"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive-foreground" />
          <AlertDescription className="text-xs font-semibold leading-normal">
            {pageState.error}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <UnclassifiedPool
          unclassifiedNotes={unclassifiedNotes}
          boxes={pageState.boxes}
          transferringNoteId={pageState.transferringNoteId}
          draggedNoteId={pageState.draggedNoteId}
          isLeftPoolOver={pageState.isLeftPoolOver}
          onDragEnter={handleDragEnterLeftPool}
          onDragLeave={handleDragLeaveLeftPool}
          onDrop={handleDropLeftPool}
          onDragStart={handleDragStartNote}
          onDragEnd={handleDragEndNote}
          onTransferNote={handleTransferNote}
          onEditNote={setPreviewNote}
        />

        <ThematicBoxesGrid
          boxes={pageState.boxes}
          notes={pageState.notes}
          overBoxId={pageState.overBoxId}
          draggedNoteId={pageState.draggedNoteId}
          transferringNoteId={pageState.transferringNoteId}
          onDragEnterBox={handleDragEnterBox}
          onDragLeaveBox={handleDragLeaveBox}
          onDropBox={handleDropBox}
          onDragStartNote={handleDragStartNote}
          onDragEndNote={handleDragEndNote}
          onTransferNote={handleTransferNote}
          onEditNote={setPreviewNote}
        />
      </div>

      <KartoteksPreviewDialog
        note={previewNote}
        boxes={pageState.boxes}
        isOpen={previewNote !== null}
        onClose={() => setPreviewNote(null)}
      />
    </div>
  );
}
