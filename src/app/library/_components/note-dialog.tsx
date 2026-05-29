"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Loader2,
  BookOpen,
  FolderClosed,
  FileText,
  Brain,
  Quote,
  Plus,
  Trash2,
  Save,
  X,
  RotateCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  saveNoteAction,
  updateNoteAction,
  retriggerAiAnalysisAction,
} from "../actions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const inlineMarkdownComponents = {
  h1: ({ children }: React.ComponentPropsWithoutRef<"h1">) => (
    <span className="block font-bold text-primary text-[10px] uppercase tracking-wider mt-1.5 mb-0.5 font-sans">
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

interface Reference {
  id: number;
  title: string;
  authors: string | null;
  year: number | null;
  doi: string | null;
  pdfUrl: string;
  abstract: string | null;
  status: string | null;
  createdAt: Date | null;
}

interface NoteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRefId: number | null;
  selectedRef: Reference | null;
  editingNoteId: number | null;
  savedNotes: Note[];
  boxes: Box[];
  onNoteSaved: () => Promise<void>;
  onSavingChange: (saving: boolean) => void;
  setNoteError: (err: string | null) => void;
  setNoteSuccess: (success: string | null) => void;
}

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

// Serialize array of QuotationRow to database string
function serializeQuotes(rows: QuotationRow[]): string {
  return rows
    .filter((r) => r.text.trim())
    .map((r) => `- s. ${cleanPageNumber(r.page) || "?"}: "${r.text.trim()}"`)
    .join("\n");
}

interface UseNoteDialogStateProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRefId: number | null;
  editingNoteId: number | null;
  savedNotes: Note[];
  onNoteSaved: () => Promise<void>;
  onSavingChange: (saving: boolean) => void;
  setNoteError: (err: string | null) => void;
  setNoteSuccess: (success: string | null) => void;
}

function useNoteDialogState({
  isOpen,
  onOpenChange,
  selectedRefId,
  editingNoteId,
  savedNotes,
  onNoteSaved,
  onSavingChange,
  setNoteError,
  setNoteSuccess,
}: UseNoteDialogStateProps) {
  const [formState, setFormState] = useState({
    boxId: null as number | null,
    mainArgument: "",
    researchNotes: "",
    quotes: [{ text: "", page: "" }] as QuotationRow[],
  });
  const [uiState, setUiState] = useState({
    isSaving: false,
    isAnalyzing: false,
  });
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevEditingNoteId, setPrevEditingNoteId] = useState(editingNoteId);

  if (isOpen !== prevIsOpen || editingNoteId !== prevEditingNoteId) {
    setPrevIsOpen(isOpen);
    setPrevEditingNoteId(editingNoteId);

    if (isOpen) {
      if (editingNoteId !== null) {
        const note = savedNotes.find((n) => n.id === editingNoteId);
        if (note) {
          setFormState({
            boxId: note.boxId,
            mainArgument: note.mainArgument || "",
            researchNotes: note.researchNotes || "",
            quotes: parseQuotes(note.quotes),
          });
        }
      } else {
        setFormState({
          boxId: null,
          mainArgument: "",
          researchNotes: "",
          quotes: [{ text: "", page: "" }],
        });
      }
    }
  }

  const currentNote =
    editingNoteId !== null
      ? savedNotes.find((n) => n.id === editingNoteId)
      : null;

  const handleRetriggerAi = async () => {
    if (editingNoteId === null) return;
    setUiState((prev) => ({ ...prev, isAnalyzing: true }));
    setNoteError(null);
    setNoteSuccess(null);
    try {
      const res = await retriggerAiAnalysisAction(editingNoteId);
      if (res.success) {
        setNoteSuccess("Yapay zeka semantik analizi başarıyla yenilendi.");
        await onNoteSaved();
      } else {
        setNoteError(
          res.error || "Yapay zeka analizi yenilenirken bir hata oluştu.",
        );
      }
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : "Yapay zeka analizi sırasında beklenmeyen bir hata oluştu.";
      setNoteError(errMsg);
    } finally {
      setUiState((prev) => ({ ...prev, isAnalyzing: false }));
    }
  };

  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const textareaRefs = React.useRef<(HTMLTextAreaElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setNoteError(null);
        setNoteSuccess(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, setNoteError, setNoteSuccess]);

  const handleClose = () => {
    setFormState({
      boxId: null,
      mainArgument: "",
      researchNotes: "",
      quotes: [{ text: "", page: "" }],
    });
    onOpenChange(false);
  };

  const handleQuoteChange = (
    index: number,
    field: keyof QuotationRow,
    value: string,
  ) => {
    setFormState((prev) => {
      const updatedQuotes = [...prev.quotes];
      updatedQuotes[index] = { ...updatedQuotes[index], [field]: value };
      return { ...prev, quotes: updatedQuotes };
    });
  };

  const handleAddQuote = () => {
    const nextIndex = formState.quotes.length;
    setFormState((prev) => ({
      ...prev,
      quotes: [...prev.quotes, { text: "", page: "" }],
    }));
    setTimeout(() => {
      inputRefs.current[nextIndex]?.focus();
    }, 0);
  };

  const handleRemoveQuote = (index: number) => {
    setFormState((prev) => {
      if (prev.quotes.length <= 1) {
        return {
          ...prev,
          quotes: [{ text: "", page: "" }],
        };
      }
      return {
        ...prev,
        quotes: prev.quotes.filter((_, i) => i !== index),
      };
    });
  };

  const handleSaveNote = async () => {
    if (selectedRefId === null) return;

    const { boxId, mainArgument, researchNotes, quotes } = formState;

    const hasMainArg = mainArgument.trim().length > 0;
    const hasResearch = researchNotes.trim().length > 0;
    const hasQuotes = quotes.some((q) => q.text.trim().length > 0);

    if (!hasMainArg && !hasResearch && !hasQuotes) {
      setNoteError(
        "Lütfen en az bir alanı doldurunuz (Ana Argüman, Gap Analizi veya Alıntı).",
      );
      setNoteSuccess(null);
      return;
    }

    setUiState((prev) => ({ ...prev, isSaving: true }));
    onSavingChange(true);
    setNoteError(null);
    setNoteSuccess(null);

    try {
      const serializedQuotes = serializeQuotes(quotes);

      if (editingNoteId !== null) {
        const res = await updateNoteAction({
          noteId: editingNoteId,
          boxId,
          mainArgument: mainArgument.trim(),
          quotes: serializedQuotes,
          researchNotes: researchNotes.trim(),
          concepts: "",
          criticalNotes: "",
          connections: "",
          memoryAnchors: "",
        });

        if (res.success) {
          setNoteSuccess("Okuma notunuz başarıyla güncellendi.");
          handleClose();
          await onNoteSaved();
        } else {
          setNoteError(res.error || "Not güncellenirken bir hata oluştu.");
        }
      } else {
        const res = await saveNoteAction(
          selectedRefId,
          {
            mainArgument: mainArgument.trim(),
            quotes: serializedQuotes,
            researchNotes: researchNotes.trim(),
            concepts: "",
            criticalNotes: "",
            connections: "",
            memoryAnchors: "",
          },
          boxId,
        );

        if (res.success) {
          setNoteSuccess("Okuma notunuz veritabanına başarıyla kaydedildi.");
          handleClose();
          await onNoteSaved();
        } else {
          setNoteError(res.error || "Not kaydedilirken bir hata oluştu.");
        }
      }
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : "İşlem sırasında beklenmeyen bir sunucu hatası oluştu.";
      setNoteError(errMsg);
    } finally {
      setUiState((prev) => ({ ...prev, isSaving: false }));
      onSavingChange(false);
    }
  };

  return {
    formState,
    setFormState,
    uiState,
    handleRetriggerAi,
    handleClose,
    handleQuoteChange,
    handleAddQuote,
    handleRemoveQuote,
    handleSaveNote,
    inputRefs,
    textareaRefs,
    currentNote,
  };
}

export function NoteDialog({
  isOpen,
  onOpenChange,
  selectedRefId,
  selectedRef,
  editingNoteId,
  savedNotes,
  boxes,
  onNoteSaved,
  onSavingChange,
  setNoteError,
  setNoteSuccess,
}: NoteDialogProps) {
  const {
    formState,
    setFormState,
    uiState,
    handleRetriggerAi,
    handleClose,
    handleQuoteChange,
    handleAddQuote,
    handleRemoveQuote,
    handleSaveNote,
    inputRefs,
    textareaRefs,
    currentNote,
  } = useNoteDialogState({
    isOpen,
    onOpenChange,
    selectedRefId,
    editingNoteId,
    savedNotes,
    onNoteSaved,
    onSavingChange,
    setNoteError,
    setNoteSuccess,
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-card border border-border p-6 flex flex-col font-sans">
        <DialogHeader className="border-b border-border pb-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4.5 text-primary" />
              <DialogTitle className="text-lg font-bold text-foreground">
                {editingNoteId !== null
                  ? "Kartoteks Düzenle"
                  : "Kartoteks Formu"}
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
        <ReferenceMetadataCard selectedRef={selectedRef} />

        {/* FORM INPUTS */}
        <div className="space-y-6 flex-1">
          {/* Tez Outline Seçimi - Box Selector */}
          <ThesisOutlineSelector
            boxId={formState.boxId}
            setBoxId={(id) => setFormState((prev) => ({ ...prev, boxId: id }))}
            boxes={boxes}
          />

          {/* Ana Argüman & Temel İzlek Kutusu */}
          <div className="flex flex-col space-y-2">
            <label
              id="main-argument-label"
              htmlFor="main-argument-textarea"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
            >
              <FileText className="size-4 text-primary shrink-0" />
              <span>Ana Argüman & Temel İzlek Kutusu</span>
            </label>
            <textarea
              id="main-argument-textarea"
              aria-labelledby="main-argument-label"
              value={formState.mainArgument}
              onChange={(e) => {
                const val = e.target.value;
                setFormState((prev) => ({ ...prev, mainArgument: val }));
              }}
              placeholder="Metnin temel savunusunu, ana iddiasını ve savunduğu ana tezi buraya girin..."
              className="min-h-[100px] p-3 bg-background border border-border rounded text-xs text-foreground focus:border-primary outline-none transition duration-150 resize-none font-sans"
            />
          </div>

          {/* Tez İle İlgisi & Gap (Eksiklik) Analizi Kutusu */}
          <div className="flex flex-col space-y-2">
            <label
              id="research-notes-label"
              htmlFor="research-notes-textarea"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
            >
              <Brain className="size-4 text-primary shrink-0" />
              <span>Tez İle İlgisi & Gap (Eksiklik) Analizi Kutusu</span>
            </label>
            <textarea
              id="research-notes-textarea"
              aria-labelledby="research-notes-label"
              value={formState.researchNotes}
              onChange={(e) => {
                const val = e.target.value;
                setFormState((prev) => ({ ...prev, researchNotes: val }));
              }}
              placeholder="Bu makalenin sizin tezinizdeki hangi boşluğu (gap) doldurduğunu ve kendi argümanınıza nasıl katkı sağladığını yazın..."
              className="min-h-[100px] p-3 bg-background border border-border rounded text-xs text-foreground focus:border-primary outline-none transition duration-150 resize-none font-sans"
            />
          </div>

          {/* Direct Quotation Station */}
          <QuotationStation
            quotes={formState.quotes}
            inputRefs={inputRefs}
            textareaRefs={textareaRefs}
            handleQuoteChange={handleQuoteChange}
            handleRemoveQuote={handleRemoveQuote}
            handleAddQuote={handleAddQuote}
            onKeyDownPage={(index) => {
              textareaRefs.current[index]?.focus();
            }}
          />

          {/* Yapay Zeka Analiz ve Semantik Bağlantılar */}
          <AiInsightPanel
            editingNoteId={editingNoteId}
            currentNote={currentNote}
            uiState={uiState}
            handleRetriggerAi={handleRetriggerAi}
            inlineMarkdownComponents={inlineMarkdownComponents}
          />
        </div>

        {/* DIALOG ACTIONS FOOTER */}
        <DialogFooterActions
          handleClose={handleClose}
          handleSaveNote={handleSaveNote}
          isSaving={uiState.isSaving}
        />
      </DialogContent>
    </Dialog>
  );
}

interface QuotationStationProps {
  quotes: QuotationRow[];
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  textareaRefs: React.MutableRefObject<(HTMLTextAreaElement | null)[]>;
  handleQuoteChange: (
    index: number,
    field: keyof QuotationRow,
    value: string,
  ) => void;
  handleRemoveQuote: (index: number) => void;
  handleAddQuote: () => void;
  onKeyDownPage: (index: number) => void;
}

function QuotationStation({
  quotes,
  inputRefs,
  textareaRefs,
  handleQuoteChange,
  handleRemoveQuote,
  handleAddQuote,
  onKeyDownPage,
}: QuotationStationProps) {
  return (
    <div className="flex flex-col space-y-3 border-t border-border pt-4">
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Quote className="size-4 text-primary shrink-0" />
        <span>Doğrudan Alıntı İstasyonu (Atıf İçin Nokta Atışı)</span>
      </label>
      <p className="text-xs text-muted-foreground leading-normal">
        Word şablonuna doğrudan kopyalayıp atıf yapabileceğiniz vurucu cümleler
        ve sayfa numaraları.
      </p>

      <div className="space-y-3">
        {quotes.map((row, index) => (
          <div
            key={`edit-quote-row-${index}-${row.page || "np"}-${row.text.substring(0, 10)}`}
            className="bg-secondary border border-border rounded-lg p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-bold">
                Alıntı #{index + 1}
              </span>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                    Sayfa No:
                  </span>
                  <input
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    value={row.page}
                    onChange={(e) =>
                      handleQuoteChange(index, "page", e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onKeyDownPage(index);
                      }
                    }}
                    placeholder="Örn: 45"
                    className="w-20 px-2 py-1 bg-background border border-border rounded text-xs text-foreground focus:border-primary outline-none transition duration-150 font-mono text-center"
                    aria-label={`Alıntı ${index + 1} sayfa numarası`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveQuote(index)}
                  className="p-1 px-1.5 bg-background border border-border rounded text-muted-foreground hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
                  title="Alıntı satırını sil"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            <textarea
              ref={(el) => {
                textareaRefs.current[index] = el;
              }}
              value={row.text}
              onChange={(e) => handleQuoteChange(index, "text", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddQuote();
                }
              }}
              placeholder="Makaleden kelimesi kelimesine kopyalanan doğrudan cümle..."
              className="w-full min-h-[60px] p-2.5 bg-background border border-border rounded text-xs text-foreground focus:border-primary outline-none transition duration-150 resize-y font-sans leading-relaxed"
              aria-label={`Alıntı ${index + 1} metni`}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddQuote}
        className="w-full sm:w-auto self-start flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded text-xs text-primary font-bold hover:bg-background transition-all cursor-pointer mt-2"
      >
        <Plus className="size-3.5" />
        <span>Yeni Alıntı Satırı Ekle</span>
      </button>
    </div>
  );
}

function ReferenceMetadataCard({
  selectedRef,
}: {
  selectedRef: Reference | null;
}) {
  if (!selectedRef) return null;
  return (
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
            {selectedRef.authors || "Bilinmeyen Yazar"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground mr-1.5">Yayın Yılı:</span>
          <span className="text-foreground font-bold font-mono">
            {selectedRef.year || "Belirtilmemiş"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground mr-1.5">
            Döküman/Kitap Başlığı:
          </span>
          <span className="text-foreground italic font-medium">
            {selectedRef.title || "Başlıksız Kaynak"}
          </span>
        </div>
      </div>
    </div>
  );
}

function ThesisOutlineSelector({
  boxId,
  setBoxId,
  boxes,
}: {
  boxId: number | null;
  setBoxId: (id: number | null) => void;
  boxes: Box[];
}) {
  return (
    <div className="flex flex-col space-y-2 bg-secondary border border-border rounded-lg p-4">
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <FolderClosed className="size-4 text-primary shrink-0" />
        <span>Tez Outline Seçimi (Tasnif)</span>
      </label>
      <p className="text-xs text-muted-foreground leading-normal">
        Bu bilgi fişinin tezinizin hangi içindekiler/outline kutusuna ait
        olduğunu belirleyin.
      </p>
      <select
        value={boxId || ""}
        onChange={(e) => {
          const val = e.target.value;
          setBoxId(val ? parseInt(val, 10) : null);
        }}
        className="bg-background border border-border text-xs rounded-md p-2.5 text-foreground font-sans outline-none focus:border-primary transition cursor-pointer"
        aria-label="Tez outline kutusu seçimi"
      >
        <option value="">-- Tasnif Dışı (Kutu Seçilmedi) --</option>
        {boxes.map((box, idx) => (
          <option key={box.id} value={box.id}>
            Bölüm {idx + 1}: {box.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function AiInsightPanel({
  editingNoteId,
  currentNote,
  uiState,
  handleRetriggerAi,
  inlineMarkdownComponents,
}: {
  editingNoteId: number | null;
  currentNote: Note | null | undefined;
  uiState: {
    isSaving: boolean;
    isAnalyzing: boolean;
  };
  handleRetriggerAi: () => Promise<void>;
  inlineMarkdownComponents: React.ComponentProps<
    typeof ReactMarkdown
  >["components"];
}) {
  if (editingNoteId === null || !currentNote) return null;
  return (
    <div className="bg-card border border-primary p-4 rounded mt-2 space-y-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-bl">
        Akademik İçgörü
      </div>

      <h4 className="text-xs font-bold text-primary flex items-center gap-2">
        <Sparkles className="size-3.5" />
        <span>AI Entegrasyon Önerisi & Künye</span>
      </h4>

      <div className="text-xs text-muted-foreground leading-relaxed font-sans prose prose-invert max-w-none [&_p]:my-0.5">
        {uiState.isAnalyzing ? (
          <div className="flex items-center gap-2 text-primary font-semibold py-1">
            <Loader2 className="size-4 animate-spin shrink-0" />
            <span>Semantik bağlantılar analiz ediliyor...</span>
          </div>
        ) : currentNote.aiContextSuggestions ? (
          <div className="space-y-3">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={inlineMarkdownComponents}
            >
              {currentNote.aiContextSuggestions}
            </ReactMarkdown>

            {/* Retrigger button below the suggestions */}
            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={handleRetriggerAi}
                disabled={uiState.isAnalyzing || uiState.isSaving}
                className="px-2.5 py-1 bg-secondary text-foreground border border-border text-[10px] font-bold uppercase tracking-wider rounded hover:bg-background disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {uiState.isAnalyzing ? (
                  <Loader2 className="size-3 animate-spin text-primary shrink-0" />
                ) : (
                  <RotateCw className="size-3 shrink-0" />
                )}
                <span>
                  {uiState.isAnalyzing
                    ? "Analiz Ediliyor..."
                    : "Yeniden Analiz Et"}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-primary font-semibold py-1">
            <Loader2 className="size-4 animate-spin shrink-0" />
            <span>Semantik bağlantılar analiz ediliyor...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DialogFooterActions({
  handleClose,
  handleSaveNote,
  isSaving,
}: {
  handleClose: () => void;
  handleSaveNote: () => Promise<void>;
  isSaving: boolean;
}) {
  return (
    <div className="border-t border-border pt-4 mt-6 flex flex-col sm:flex-row justify-end gap-3">
      <button
        type="button"
        onClick={handleClose}
        className="px-4 py-2 rounded-lg bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-colors"
      >
        Vazgeç
      </button>
      <button
        type="button"
        onClick={handleSaveNote}
        disabled={isSaving}
        className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 disabled:opacity-50 cursor-pointer transition-all"
      >
        {isSaving ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            <span>Kaydediliyor...</span>
          </>
        ) : (
          <>
            <Save className="size-3.5" />
            <span>Değişiklikleri Kaydet</span>
          </>
        )}
      </button>
    </div>
  );
}
