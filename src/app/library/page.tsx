"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  UploadCloud,
  FileText,
  Download,
  Check,
  AlertCircle,
  Loader2,
  BookOpen,
  Plus,
  Sparkles,
  Trash2,
  Quote,
  Tags,
  Link2,
  Compass,
  Brain,
  Pencil,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  uploadPdfAction,
  getReferencesAction,
  saveNoteAction,
  getNotesAction,
  getThesisBoxesAction,
  deleteReferenceAction,
  updateNoteAction,
} from "./actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ReactMarkdown from "react-markdown";

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
  downloadUrl: string;
}

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

export default function LibraryPage() {
  const [references, setReferences] = useState<Reference[]>([]);
  const [selectedRefId, setSelectedRefId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const [mobileTab, setMobileTab] = useState("references");

  // Notes States
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [savedNotes, setSavedNotes] = useState<Note[]>([]);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSuccess, setNoteSuccess] = useState<string | null>(null);

  // Structured Notes States
  const [mainArgument, setMainArgument] = useState("");
  const [quotes, setQuotes] = useState("");
  const [concepts, setConcepts] = useState("");
  const [criticalNotes, setCriticalNotes] = useState("");
  const [connections, setConnections] = useState("");
  const [researchNotes, setResearchNotes] = useState("");
  const [memoryAnchors, setMemoryAnchors] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Thesis Boxes States for classification
  const [boxes, setBoxes] = useState<
    Array<{ id: number; name: string; description: string | null }>
  >([]);
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);
  const [filterByBox, setFilterByBox] = useState(false);
  const [deleteDialogOpenId, setDeleteDialogOpenId] = useState<number | null>(
    null,
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const clearNoteForm = useCallback(() => {
    setMainArgument("");
    setQuotes("");
    setConcepts("");
    setCriticalNotes("");
    setConnections("");
    setResearchNotes("");
    setMemoryAnchors("");
    setEditingNoteId(null);
    setIsDialogOpen(false);
  }, []);

  const loadReferences = useCallback(async () => {
    try {
      const res = await getReferencesAction();
      if (res.success && res.references) {
        setReferences(res.references);

        let initialRefId: number | null = null;
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const refIdParam = params.get("refId");
          const refTitleParam = params.get("refTitle");

          if (refIdParam) {
            const id = parseInt(refIdParam, 10);
            if (!isNaN(id)) {
              initialRefId = id;
            }
          } else if (refTitleParam) {
            const decodedTitle = decodeURIComponent(refTitleParam)
              .toLowerCase()
              .trim();
            const matchedRef = res.references.find(
              (ref) =>
                ref.title.toLowerCase().trim() === decodedTitle ||
                ref.title.toLowerCase().includes(decodedTitle) ||
                decodedTitle.includes(ref.title.toLowerCase()),
            );
            if (matchedRef) {
              initialRefId = matchedRef.id;
            }
          }
        }

        if (initialRefId !== null) {
          setSelectedRefId(initialRefId);
        } else if (res.references.length > 0) {
          setSelectedRefId((prev) =>
            prev === null ? res.references![0].id : prev,
          );
        }
      }
    } catch (err) {
      console.error("Failed to load references:", err);
    }
  }, []);

  const loadNotes = useCallback(async (refId: number) => {
    try {
      const res = await getNotesAction(refId);
      if (res.success && res.notes) {
        setSavedNotes(res.notes as Note[]);
      }
    } catch (err) {
      console.error("Failed to load notes:", err);
    }
  }, []);

  // Load references and thesis boxes on mount
  useEffect(() => {
    let active = true;
    const handle = requestAnimationFrame(async () => {
      if (!active) return;
      loadReferences();

      try {
        const res = await getThesisBoxesAction();
        if (res.success && res.boxes) {
          setBoxes(res.boxes);

          const params = new URLSearchParams(window.location.search);
          const boxIdParam = params.get("boxId");
          if (boxIdParam) {
            const bId = parseInt(boxIdParam, 10);
            if (!isNaN(bId)) {
              setSelectedBoxId(bId);
              setFilterByBox(true);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load thesis boxes in library page:", err);
      }
    });
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [loadReferences]);

  // Load notes whenever selectedRefId changes
  useEffect(() => {
    let active = true;
    const handle = requestAnimationFrame(() => {
      if (!active) return;
      if (selectedRefId !== null) {
        loadNotes(selectedRefId);
        // Reset note input states on reference switch
        clearNoteForm();
        setNoteError(null);
        setNoteSuccess(null);
      } else {
        setSavedNotes([]);
      }
    });
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [selectedRefId, loadNotes, clearNoteForm]);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setUploadError("Yalnızca PDF dosyaları yüklenebilir.");
      setUploadSuccess(null);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadPdfAction(formData);

      if (result.success) {
        setUploadSuccess(`"${file.name}" başarıyla kütüphaneye eklendi.`);
        // Reload library references from Neon DB
        await loadReferences();
        // Select the newly uploaded reference if ID is returned
        if (result.referenceId) {
          setSelectedRefId(result.referenceId);
          // Auto switch to notes on mobile to show details immediately
          setMobileTab("notes");
        }
      } else {
        setUploadError(result.error || "Yükleme sırasında hata oluştu.");
      }
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : "Dosya yüklenirken ağ veya sunucu hatası oluştu.";
      setUploadError(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const startEditingNote = (note: Note) => {
    setEditingNoteId(note.id);
    setSelectedBoxId(note.boxId);
    setMainArgument(note.mainArgument || "");
    setQuotes(note.quotes || "");
    setConcepts(note.concepts || "");
    setCriticalNotes(note.criticalNotes || "");
    setConnections(note.connections || "");
    setResearchNotes(note.researchNotes || "");
    setMemoryAnchors(note.memoryAnchors || "");
    setIsDialogOpen(true);
  };

  const handleSaveNote = async () => {
    if (selectedRefId === null) return;

    if (
      !mainArgument.trim() &&
      !quotes.trim() &&
      !concepts.trim() &&
      !criticalNotes.trim() &&
      !connections.trim() &&
      !researchNotes.trim() &&
      !memoryAnchors.trim()
    ) {
      setNoteError("Lütfen en az bir akademik alanı doldurun.");
      setNoteSuccess(null);
      return;
    }

    setIsSavingNote(true);
    setNoteError(null);
    setNoteSuccess(null);

    try {
      if (editingNoteId !== null) {
        const res = await updateNoteAction({
          noteId: editingNoteId,
          boxId: selectedBoxId,
          mainArgument: mainArgument.trim(),
          quotes: quotes.trim(),
          concepts: concepts.trim(),
          criticalNotes: criticalNotes.trim(),
          connections: connections.trim(),
          researchNotes: researchNotes.trim(),
          memoryAnchors: memoryAnchors.trim(),
        });

        if (res.success) {
          setNoteSuccess("Okuma notunuz başarıyla güncellendi.");
          clearNoteForm();
          await loadNotes(selectedRefId);
        } else {
          setNoteError(res.error || "Not güncellenirken bir hata oluştu.");
        }
      } else {
        const res = await saveNoteAction(
          selectedRefId,
          {
            mainArgument: mainArgument.trim(),
            quotes: quotes.trim(),
            concepts: concepts.trim(),
            criticalNotes: criticalNotes.trim(),
            connections: connections.trim(),
            researchNotes: researchNotes.trim(),
            memoryAnchors: memoryAnchors.trim(),
          },
          selectedBoxId,
        );

        if (res.success) {
          setNoteSuccess("Okuma notunuz veritabanına başarıyla kaydedildi.");
          clearNoteForm();
          await loadNotes(selectedRefId);
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
      setIsSavingNote(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDeleteReference = async (id: number) => {
    try {
      const res = await deleteReferenceAction(id);
      if (res.success) {
        setUploadSuccess("Makale ve ilişkili tüm verileri başarıyla silindi.");
        setUploadError(null);

        // If the deleted reference was selected, reset selection
        if (selectedRefId === id) {
          setSelectedRefId(null);
        }

        // Reload references list
        await loadReferences();
      } else {
        setUploadError(res.error || "Makale silinirken bir hata oluştu.");
        setUploadSuccess(null);
      }
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : "Makale silinirken beklenmeyen bir hata oluştu.";
      setUploadError(errMsg);
      setUploadSuccess(null);
    }
  };

  const getSelectedReference = () => {
    return references.find((ref) => ref.id === selectedRefId);
  };

  const selectedRef = getSelectedReference();

  const displayedNotes =
    filterByBox && selectedBoxId !== null
      ? savedNotes.filter((note) => note.boxId === selectedBoxId)
      : savedNotes;

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground p-6 md:p-10 font-sans">
      {/* Header */}
      <header className="border-b border-border pb-6 mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Kütüphane & Not Laboratuvarı
          </h1>
          <p className="text-sm text-muted-foreground">
            PDF yükleyin, R2 deposunda arşivleyin ve okuma notları alın
          </p>
        </div>
        <span className="text-xs font-mono text-primary bg-card border border-border px-3 py-1 rounded">
          Phase 2 - Active
        </span>
      </header>

      {/* Mobile Tab Switcher */}
      <Tabs
        value={mobileTab}
        onValueChange={(v) => setMobileTab(v as string)}
        className="lg:hidden mb-6"
      >
        <TabsList className="w-full bg-card border border-border p-1 rounded">
          <TabsTrigger value="references" className="flex-1">
            1. Dosya Yükleme & Kaynaklar
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1">
            2. Okuma Notları & Atıflar
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-8 flex-1">
        {/* Left Column: Dropzone and Uploaded References (Visible on Desktop OR Mobile Active Tab) */}
        <div
          className={`border border-border bg-card p-6 rounded-lg shadow-xl flex flex-col space-y-6 ${
            mobileTab === "references" ? "flex" : "hidden lg:flex"
          }`}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            1. Dosya Yükleme & Kaynaklar
          </h2>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={inputRef}
            onChange={onFileChange}
            accept="application/pdf"
            className="hidden"
          />

          {/* Dynamic Dropzone Area */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className={`border-2 border-dashed rounded-lg p-10 text-center flex flex-col items-center justify-center cursor-pointer transition duration-200 bg-background ${
              isDragging
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
            }`}
          >
            {isUploading ? (
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium text-primary">
                  Dosya R2 bulut deposuna aktarılıyor...
                </p>
                <p className="text-xs text-muted-foreground">
                  Lütfen tarayıcıyı kapatmayın
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <UploadCloud
                  className={`h-10 w-10 mb-4 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`}
                />
                <p className="text-sm font-semibold">
                  PDF dosyasını sürükleyin veya seçin
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Bulut yüklemesi Next.js ve Cloudflare R2 ile korunur
                </p>
              </div>
            )}
          </div>

          {/* Feedback Alerts */}
          {uploadError && (
            <Alert
              variant="destructive"
              className="border-destructive bg-destructive/10 text-destructive-foreground"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive-foreground" />
              <AlertDescription className="text-xs font-semibold leading-none">
                {uploadError}
              </AlertDescription>
            </Alert>
          )}

          {uploadSuccess && (
            <Alert className="border-primary bg-primary/10 text-primary">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              <AlertDescription className="text-xs font-semibold leading-none">
                {uploadSuccess}
              </AlertDescription>
            </Alert>
          )}

          {/* References List */}
          <div className="flex-1 flex flex-col space-y-3 min-h-[250px]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kütüphanedeki PDF Makaleler ({references.length})
            </h3>

            {references.length === 0 ? (
              <div className="flex-1 border border-border rounded flex items-center justify-center text-xs text-muted-foreground bg-background p-8 text-center">
                Henüz yüklenmiş makale bulunmuyor. PDF sürükleyerek hemen
                başlayın.
              </div>
            ) : (
              <div className="space-y-2">
                {references.map((ref) => {
                  const isSelected = ref.id === selectedRefId;
                  return (
                    <div
                      key={ref.id}
                      onClick={() => {
                        setSelectedRefId(ref.id);
                        setMobileTab("notes"); // Smoothly switch tab on mobile!
                      }}
                      className={`border p-4 rounded-lg flex flex-col justify-between items-stretch cursor-pointer transition duration-200 ${
                        isSelected
                          ? "border-primary bg-background shadow-md"
                          : "border-border bg-background hover:border-border hover:bg-card"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <FileText
                          className={`h-5 w-5 flex-shrink-0 mt-0.5 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-foreground transition-colors">
                            {ref.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {ref.authors || "Bilinmeyen Yazar"} •{" "}
                            {ref.year || "Yıl Belirtilmemiş"}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end items-center mt-3 pt-3 border-t border-border space-x-3">
                        {ref.status === "tamamlandı" && (
                          <span className="mr-auto text-[10px] uppercase font-mono px-2.5 py-1.5 rounded bg-primary text-background font-bold">
                            Tamamlandı
                          </span>
                        )}
                        <a
                          href={ref.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center space-x-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded border border-border bg-card"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>PDF İndir</span>
                        </a>
                        <AlertDialog
                          open={deleteDialogOpenId === ref.id}
                          onOpenChange={(open) =>
                            setDeleteDialogOpenId(open ? ref.id : null)
                          }
                        >
                          <AlertDialogTrigger
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center p-1.5 rounded border border-border bg-card text-muted-foreground hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
                            title="Makaleyi Sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </AlertDialogTrigger>
                          <AlertDialogContent
                            className="border border-border bg-card"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-sans text-foreground">
                                Makaleyi Sil
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-xs text-muted-foreground">
                                &ldquo;<strong>{ref.title}</strong>&rdquo;
                                isimli makaleyi ve bu makaleye ait tüm okuma
                                notlarını, RAG parçalarını, görevleri ve yapay
                                zeka analizlerini kalıcı olarak silmek
                                istediğinize emin misiniz? Bu işlem geri
                                alınamaz.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel
                                className="border-border text-foreground hover:bg-muted cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                İptal
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteDialogOpenId(null);
                                  handleDeleteReference(ref.id);
                                }}
                                className="bg-destructive text-destructive-foreground hover:opacity-90 cursor-pointer"
                              >
                                Evet, Sil
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <span
                          className={`text-[10px] uppercase font-mono px-2 py-1.5 rounded transition-all duration-200 ${
                            isSelected
                              ? "bg-primary text-background font-semibold"
                              : "bg-card text-muted-foreground border border-border"
                          }`}
                        >
                          {isSelected ? "Seçili" : "Seç"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Reading Notes Textarea & Suggestions (Visible on Desktop OR Mobile Active Tab) */}
        <div
          className={`border border-border bg-card p-6 rounded-lg shadow-xl flex flex-col space-y-6 ${
            mobileTab === "notes" ? "flex" : "hidden lg:flex"
          }`}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            2. Okuma Notları & Atıflar
          </h2>

          {selectedRef ? (
            <div className="flex flex-col space-y-6 flex-1">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-mono text-primary bg-background border border-border px-2 py-1 rounded">
                  Aktif Çalışma Odası
                </span>
                <h3 className="text-lg font-bold text-foreground mt-2 truncate">
                  {selectedRef.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Yazar: {selectedRef.authors || "Belirtilmemiş"} | Yıl:{" "}
                  {selectedRef.year || "Belirtilmemiş"}
                  {selectedRef.doi && ` | DOI: ${selectedRef.doi}`}
                </p>
              </div>

              {/* Dynamic Abstract Box */}
              {selectedRef.abstract && (
                <div className="bg-background border border-border p-4 rounded-lg transition-all duration-200">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Özet / Abstract
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedRef.abstract}
                  </p>
                </div>
              )}

              {/* Kartoteks Fişi Ekleme Butonu */}
              <button
                onClick={() => {
                  clearNoteForm();
                  setIsDialogOpen(true);
                }}
                className="w-full bg-primary text-background font-semibold text-sm py-3 rounded-lg transition duration-200 flex items-center justify-center space-x-2 hover:bg-primary/95 cursor-pointer"
              >
                <Plus className="h-4 w-4 text-background" />
                <span>Makale Notu Ekle</span>
              </button>

              {/* Dialog (Modal) for Structured Note Form */}
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-[92vw] sm:max-w-[700px] overflow-hidden flex flex-col max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="size-4.5 text-primary" />
                      <span>
                        {editingNoteId !== null
                          ? "Kartoteks Düzenle"
                          : "Kartoteks Formu"}
                      </span>
                    </DialogTitle>
                    <DialogDescription>
                      Makaleden çıkardığınız akademik notları kategorize edilmiş
                      şekilde girin.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-5">
                    {/* Tasnif Seçici */}
                    {boxes.length > 0 && (
                      <div className="flex flex-col space-y-2 bg-muted/40 border border-border rounded-lg p-4 transition duration-150">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-primary shrink-0" />
                          <span>Entelektüel Kumbara (Tasnif)</span>
                        </label>
                        <p className="text-[10px] text-muted-foreground leading-normal mb-1">
                          Notunuzu doğrudan tezinizin ilgili bölümüne fırlatarak
                          arşivleyin.
                        </p>
                        <select
                          value={selectedBoxId || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedBoxId(val ? parseInt(val, 10) : null);
                          }}
                          className="bg-card border border-border text-xs rounded-md p-2.5 text-foreground font-sans outline-none focus:border-primary/50 transition cursor-pointer"
                        >
                          <option value="">
                            -- Tasnif Dışı (Kumbara Seçilmedi) --
                          </option>
                          {boxes.map((box, idx) => (
                            <option key={box.id} value={box.id}>
                              Bölüm {idx + 1}: {box.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 1. Ana Argüman */}
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <FileText className="size-3.5 text-primary shrink-0" />
                        <span>Ana Argüman (Tez)</span>
                      </label>
                      <Textarea
                        value={mainArgument}
                        onChange={(e) => setMainArgument(e.target.value)}
                        placeholder="Metnin temel tezini ve ana savunu buraya yazın..."
                        className="min-h-[90px] p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 resize-none font-sans"
                      />
                    </div>

                    {/* 2. Önemli Alıntılar */}
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Quote className="size-3.5 text-primary shrink-0" />
                        <span>Önemli Alıntılar (Sayfa No ile)</span>
                      </label>
                      <Textarea
                        value={quotes}
                        onChange={(e) => setQuotes(e.target.value)}
                        placeholder="Sayfa numaralarıyla birlikte birebir atıf alıntılarını ekleyin (Örn: Sayfa 24: '...')"
                        className="min-h-[90px] p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 resize-none font-sans"
                      />
                    </div>

                    {/* 3. Kavramlar ve Temalar */}
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Tags className="size-3.5 text-primary shrink-0" />
                        <span>Kavramlar ve Temalar</span>
                      </label>
                      <Input
                        value={concepts}
                        onChange={(e) => setConcepts(e.target.value)}
                        placeholder="Virgülle ayırarak anahtar kavramları girin (Örn: Disiplin, VYŞ, İktidar)"
                        className="p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 font-sans h-9"
                      />
                    </div>

                    {/* 4. Eleştirel Not */}
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <AlertCircle className="size-3.5 text-primary shrink-0" />
                        <span>Eleştirel Not</span>
                      </label>
                      <Textarea
                        value={criticalNotes}
                        onChange={(e) => setCriticalNotes(e.target.value)}
                        placeholder="Yazarın argümanına veya teorik çerçevesine dair kendi eleştirileriniz..."
                        className="min-h-[90px] p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 resize-none font-sans"
                      />
                    </div>

                    {/* 5. Diğer Metinlerle Bağlantı */}
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Link2 className="size-3.5 text-primary shrink-0" />
                        <span>Diğer Metinlerle Bağlantı</span>
                      </label>
                      <Textarea
                        value={connections}
                        onChange={(e) => setConnections(e.target.value)}
                        placeholder="Literatürdeki diğer makalelerle veya teorilerle kurduğu organik bağlar..."
                        className="min-h-[90px] p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 resize-none font-sans"
                      />
                    </div>

                    {/* 6. Araştırmam İçin Not */}
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Compass className="size-3.5 text-primary shrink-0" />
                        <span>Araştırmam İçin Not</span>
                      </label>
                      <Textarea
                        value={researchNotes}
                        onChange={(e) => setResearchNotes(e.target.value)}
                        placeholder="Bu notun doğrudan sizin tezinize/araştırmanıza nasıl katkı sunacağı..."
                        className="min-h-[90px] p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 resize-none font-sans"
                      />
                    </div>

                    {/* 7. Hafıza Notu */}
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Brain className="size-3.5 text-primary shrink-0" />
                        <span>Hafıza Notu</span>
                      </label>
                      <Textarea
                        value={memoryAnchors}
                        onChange={(e) => setMemoryAnchors(e.target.value)}
                        placeholder="Metni zihinde tutmayı kolaylaştıracak kişisel ipuçları veya somutlama cümleleri..."
                        className="min-h-[60px] p-3 bg-card border border-border rounded text-xs text-foreground focus-visible:ring-1 focus-visible:ring-primary transition duration-150 resize-none font-sans"
                      />
                    </div>
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <button
                      type="button"
                      onClick={clearNoteForm}
                      className="px-4 py-2.5 border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-card transition duration-150 cursor-pointer"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNote}
                      disabled={isSavingNote}
                      className="px-4 py-2.5 bg-primary text-background rounded-lg text-xs font-semibold hover:bg-primary/90 transition duration-150 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingNote && (
                        <Loader2 className="size-3 animate-spin text-background" />
                      )}
                      <span>Değişiklikleri Kaydet</span>
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Feedback Alerts for Note */}
              {noteError && (
                <Alert
                  variant="destructive"
                  className="border-destructive bg-destructive/10 text-destructive-foreground"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive-foreground" />
                  <AlertDescription className="text-xs font-semibold leading-none">
                    {noteError}
                  </AlertDescription>
                </Alert>
              )}

              {noteSuccess && (
                <Alert className="border-primary bg-primary/10 text-primary">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  <AlertDescription className="text-xs font-semibold leading-none">
                    {noteSuccess}
                  </AlertDescription>
                </Alert>
              )}

              {/* Saved Notes List Section */}
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
                          Yeni akademik kartoteks kaydı işleniyor ve vektör
                          embedding hesaplanıyor...
                        </p>

                        <div className="bg-card border border-primary p-4 rounded mt-2 space-y-3 relative">
                          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-bl">
                            Akademik İçgörü
                          </div>
                          <h4 className="text-xs font-bold text-primary flex items-center gap-2">
                            <Sparkles className="size-3.5 animate-spin" />
                            <span>
                              Akademik Bağlam ve Atıf Analizi Yapılıyor...
                            </span>
                          </h4>
                          <div className="text-xs text-muted-foreground flex items-center space-x-2">
                            <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                            <span>
                              Gemini 3.1 Flash Lite tezinize entegrasyon
                              yollarını çiziyor...
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
                            <AccordionItem
                              value="details"
                              className="border-none"
                            >
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
                              <ReactMarkdown>
                                {note.aiContextSuggestions}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center text-center space-y-4 py-12 bg-background rounded border border-border flex-1">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-lg font-bold text-foreground">
                Seçili Makale Bulunmuyor
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Okuma notları almak, APA atıflarını düzenlemek ve dijital
                danışman hocanızla tartışmak için sol sütundan bir makale seçin
                veya yeni bir PDF yükleyin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
