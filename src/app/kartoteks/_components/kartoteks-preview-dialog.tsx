import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  FileText,
  Brain,
  Quote,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";
import { Note, ThesisBox } from "../types";
import { parseQuotes, inlineMarkdownComponents } from "./markdown-renderers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

interface KartoteksPreviewDialogProps {
  note: Note | null;
  boxes: ThesisBox[];
  isOpen: boolean;
  onClose: () => void;
}

export function KartoteksPreviewDialog({
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
              <span className="size-4 rounded-full border border-primary/20 flex items-center justify-center text-[10px] text-primary bg-primary/10">
                📦
              </span>
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
