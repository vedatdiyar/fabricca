"use client";

import React, { useRef, useState, useEffect } from "react";
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
} from "lucide-react";
import {
  uploadPdfAction,
  getReferencesAction,
  saveNoteAction,
  getNotesAction,
} from "./actions";
import ReactMarkdown from "react-markdown";

interface Reference {
  id: number;
  title: string;
  authors: string | null;
  year: number | null;
  doi: string | null;
  pdfUrl: string;
  abstract: string | null;
  createdAt: Date | null;
  downloadUrl: string;
}

interface Note {
  id: number;
  referenceId: number | null;
  content: string;
  aiContextSuggestions: string | null;
  isUserNote: boolean | null;
  createdAt: Date | null;
}

export default function LibraryPage() {
  const [references, setReferences] = useState<Reference[]>([]);
  const [selectedRefId, setSelectedRefId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Custom mobile tab switcher state
  const [activeTab, setActiveTab] = useState<"references" | "notes">(
    "references",
  );

  // Notes States
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [savedNotes, setSavedNotes] = useState<Note[]>([]);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSuccess, setNoteSuccess] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load references from database on mount
  useEffect(() => {
    loadReferences();
  }, []);

  // Load notes whenever selectedRefId changes
  useEffect(() => {
    if (selectedRefId !== null) {
      loadNotes(selectedRefId);
      // Reset note input states on reference switch
      setNoteContent("");
      setNoteError(null);
      setNoteSuccess(null);
    } else {
      setSavedNotes([]);
    }
  }, [selectedRefId]);

  const loadReferences = async () => {
    try {
      const res = await getReferencesAction();
      if (res.success && res.references) {
        setReferences(res.references);
        // Automatically select the first one if none selected
        if (res.references.length > 0 && selectedRefId === null) {
          setSelectedRefId(res.references[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load references:", err);
    }
  };

  const loadNotes = async (refId: number) => {
    try {
      const res = await getNotesAction(refId);
      if (res.success && res.notes) {
        setSavedNotes(res.notes);
      }
    } catch (err) {
      console.error("Failed to load notes:", err);
    }
  };

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
          setActiveTab("notes");
        }
      } else {
        setUploadError(result.error || "Yükleme sırasında hata oluştu.");
      }
    } catch (err: any) {
      setUploadError(
        err.message || "Dosya yüklenirken ağ veya sunucu hatası oluştu.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveNote = async () => {
    if (selectedRefId === null) return;
    if (!noteContent || !noteContent.trim()) {
      setNoteError("Not içeriği boş olamaz.");
      setNoteSuccess(null);
      return;
    }

    setIsSavingNote(true);
    setNoteError(null);
    setNoteSuccess(null);

    try {
      const res = await saveNoteAction(selectedRefId, noteContent);
      if (res.success) {
        setNoteSuccess("Okuma notunuz veritabanına başarıyla kaydedildi.");
        setNoteContent(""); // Clear textarea
        // Reload notes list for this reference
        await loadNotes(selectedRefId);
      } else {
        setNoteError(res.error || "Not kaydedilirken bir hata oluştu.");
      }
    } catch (err: any) {
      setNoteError(
        err.message ||
          "Not kaydedilirken beklenmeyen bir sunucu hatası oluştu.",
      );
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

  const getSelectedReference = () => {
    return references.find((ref) => ref.id === selectedRefId);
  };

  const selectedRef = getSelectedReference();

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
      <div className="flex lg:hidden border border-border rounded-lg bg-card p-1 mb-6">
        <button
          onClick={() => setActiveTab("references")}
          className={`flex-1 py-2.5 text-center text-xs font-semibold rounded-md transition-all ${
            activeTab === "references"
              ? "bg-primary text-background"
              : "text-muted-foreground"
          }`}
        >
          1. Dosya Yükleme & Kaynaklar
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`flex-1 py-2.5 text-center text-xs font-semibold rounded-md transition-all ${
            activeTab === "notes"
              ? "bg-primary text-background"
              : "text-muted-foreground"
          }`}
        >
          2. Okuma Notları & Atıflar
        </button>
      </div>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        {/* Left Column: Dropzone and Uploaded References (Visible on Desktop OR Mobile Active Tab) */}
        <div
          className={`border border-border bg-card p-6 rounded-lg shadow-xl flex flex-col space-y-6 ${
            activeTab === "references" ? "flex" : "hidden lg:flex"
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
            <div className="flex items-center space-x-2 border border-border bg-background p-3.5 rounded text-sm text-foreground">
              <AlertCircle className="h-5 w-5 text-foreground" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="flex items-center space-x-2 border border-border bg-background p-3.5 rounded text-sm text-primary">
              <Check className="h-5 w-5 text-primary" />
              <span>{uploadSuccess}</span>
            </div>
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
                        setActiveTab("notes"); // Smoothly switch tab on mobile!
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
            activeTab === "notes" ? "flex" : "hidden lg:flex"
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
                  <p className="text-xs text-muted-foreground leading-relaxed italic">
                    {selectedRef.abstract}
                  </p>
                </div>
              )}

              {/* Reading Notes Textarea */}
              <div className="flex flex-col space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Toplu Makale Okuma Notu
                </label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Bu makaleden çıkardığınız ana tezleri, metodolojik bulguları veya tezinizde kullanacağınız kritik paragrafları buraya not edin..."
                  className="min-h-[140px] p-4 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition duration-150 resize-none font-sans"
                />
              </div>

              {/* Feedback Alerts for Note */}
              {noteError && (
                <div className="flex items-center space-x-2 border border-border bg-background p-3.5 rounded text-sm text-foreground">
                  <AlertCircle className="h-5 w-5 text-foreground" />
                  <span>{noteError}</span>
                </div>
              )}

              {noteSuccess && (
                <div className="flex items-center space-x-2 border border-border bg-background p-3.5 rounded text-sm text-primary">
                  <Check className="h-5 w-5 text-primary" />
                  <span>{noteSuccess}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleSaveNote}
                disabled={isSavingNote}
                className={`w-full bg-primary text-background font-semibold text-sm py-3 rounded-lg transition duration-200 flex items-center justify-center space-x-2 ${
                  isSavingNote
                    ? "animate-pulse shadow-lg shadow-primary"
                    : "hover:bg-primary"
                }`}
              >
                {isSavingNote ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-background" />
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 text-background" />
                    <span>Notu Kaydet & Vektörleştir</span>
                  </>
                )}
              </button>

              {/* Saved Notes List Section */}
              <div className="border-t border-border pt-6 flex flex-col space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Kayıtlı Okuma Notları ({savedNotes.length})</span>
                </h3>

                {savedNotes.length === 0 && !isSavingNote ? (
                  <div className="flex-1 border border-border rounded flex items-center justify-center text-xs text-muted-foreground bg-background p-6 text-center italic">
                    Bu makaleye ait henüz kayıtlı okuma notu bulunmuyor.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Glowing AI Loading Placeholder card when isSavingNote is true */}
                    {isSavingNote && (
                      <div className="p-4 bg-background border border-primary rounded-lg text-sm flex flex-col space-y-3 animate-pulse relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                        <p className="text-foreground leading-relaxed whitespace-pre-wrap italic opacity-80">
                          {noteContent || "Yeni okuma notu..."}
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

                    {savedNotes.map((note) => (
                      <div
                        key={note.id}
                        className="p-4 bg-background border border-border rounded-lg text-sm flex flex-col space-y-2 hover:border-border transition duration-150"
                      >
                        <p className="text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                          {note.content}
                        </p>
                        <span className="text-[10px] text-muted-foreground font-mono self-end">
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
                            <div className="text-xs text-muted-foreground leading-relaxed font-sans space-y-3 prose prose-invert max-w-none">
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
