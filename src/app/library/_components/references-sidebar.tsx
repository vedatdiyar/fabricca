"use client";

import React, { useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  Download,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { uploadPdfAction, deleteReferenceAction } from "../actions";

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

interface ReferencesSidebarProps {
  references: Reference[];
  selectedRefId: number | null;
  setSelectedRefId: React.Dispatch<React.SetStateAction<number | null>>;
  mobileTab: string;
  setMobileTab: (tab: string) => void;
  loadReferences: () => Promise<void>;
}

export function ReferencesSidebar({
  references,
  selectedRefId,
  setSelectedRefId,
  mobileTab,
  setMobileTab,
  loadReferences,
}: ReferencesSidebarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deleteDialogOpenId, setDeleteDialogOpenId] = useState<number | null>(
    null,
  );

  const inputRef = useRef<HTMLInputElement>(null);

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
        setUploadSuccess(
          "Dosya kütüphaneye eklendi, metin analizi ve indeksleme arka planda başlatıldı.",
        );
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

  const renderDropZoneInfo = () => {
    if (isUploading) {
      return (
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-primary">
            Dosya R2 bulut deposuna aktarılıyor...
          </p>
          <p className="text-xs text-muted-foreground">
            Lütfen tarayıcıyı kapatmayın
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center">
        <UploadCloud
          className={`h-10 w-10 mb-4 transition-colors ${
            isDragging ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <p className="text-sm font-semibold">
          PDF dosyasını sürükleyin veya seçin
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Bulut yüklemesi Next.js ve Cloudflare R2 ile korunur
        </p>
      </div>
    );
  };

  return (
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
        aria-label="PDF formatında akademik makale yükleme girdisi"
      />

      {/* Dynamic Dropzone Area */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
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
        {renderDropZoneInfo()}
      </div>

      {/* Feedback Alerts */}
      {uploadError && (
        <Alert
          variant="destructive"
          className="border-destructive bg-destructive/10 text-destructive-foreground items-center"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive-foreground" />
          <AlertDescription className="text-xs font-semibold leading-normal">
            {uploadError}
          </AlertDescription>
        </Alert>
      )}

      {uploadSuccess && (
        <Alert className="border-primary bg-primary/10 text-primary items-center">
          <Check className="h-4 w-4 shrink-0 text-primary" />
          <AlertDescription className="text-xs font-semibold leading-normal">
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
            Henüz yüklenmiş makale bulunmuyor. PDF sürükleyerek hemen başlayın.
          </div>
        ) : (
          <div className="space-y-2">
            {references.map((ref) => (
              <ReferenceItem
                key={ref.id}
                refItem={ref}
                isSelected={ref.id === selectedRefId}
                setSelectedRefId={setSelectedRefId}
                setMobileTab={setMobileTab}
                deleteDialogOpenId={deleteDialogOpenId}
                setDeleteDialogOpenId={setDeleteDialogOpenId}
                handleDeleteReference={handleDeleteReference}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ReferenceItemProps {
  refItem: Reference;
  isSelected: boolean;
  setSelectedRefId: React.Dispatch<React.SetStateAction<number | null>>;
  setMobileTab: (tab: string) => void;
  deleteDialogOpenId: number | null;
  setDeleteDialogOpenId: (id: number | null) => void;
  handleDeleteReference: (id: number) => Promise<void>;
}

function ReferenceItem({
  refItem,
  isSelected,
  setSelectedRefId,
  setMobileTab,
  deleteDialogOpenId,
  setDeleteDialogOpenId,
  handleDeleteReference,
}: ReferenceItemProps) {
  const isProcessing =
    refItem.status?.toLowerCase() === "processing" ||
    refItem.status?.toLowerCase() === "running";

  return (
    <div
      role="button"
      tabIndex={isProcessing ? -1 : 0}
      onClick={() => {
        if (isProcessing) return;
        setSelectedRefId(refItem.id);
        setMobileTab("notes"); // Smoothly switch tab on mobile!
      }}
      onKeyDown={(e) => {
        if (isProcessing) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSelectedRefId(refItem.id);
          setMobileTab("notes");
        }
      }}
      className={`border p-4 rounded-lg flex flex-col justify-between items-stretch transition duration-200 ${
        isProcessing
          ? "opacity-50 pointer-events-none border-border bg-background cursor-not-allowed"
          : isSelected
            ? "border-primary bg-background shadow-md cursor-pointer"
            : "border-border bg-background hover:border-border hover:bg-card cursor-pointer"
      }`}
    >
      <div className="flex items-start space-x-3">
        <FileText
          className={`h-5 w-5 flex-shrink-0 mt-0.5 transition-colors ${
            isSelected ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold truncate text-foreground transition-colors flex-1">
              {refItem.title}
            </p>
            {isProcessing && (
              <span className="animate-pulse bg-[#eab308] text-[#121212] text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-[#d97706] inline-flex items-center gap-1 shrink-0">
                <Loader2 className="h-2.5 w-2.5 animate-spin text-[#121212]" />
                <span>Analiz Ediliyor...</span>
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {refItem.authors || "Bilinmeyen Yazar"} •{" "}
            {refItem.year || "Yıl Belirtilmemiş"}
          </p>
        </div>
      </div>

      <div className="flex justify-end items-center mt-3 pt-3 border-t border-border space-x-3">
        {refItem.status === "tamamlandı" && (
          <span className="mr-auto text-[10px] uppercase font-mono px-2.5 py-1.5 rounded bg-primary text-background font-bold">
            Tamamlandı
          </span>
        )}
        <a
          href={refItem.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center space-x-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded border border-border bg-card"
        >
          <Download className="h-3.5 w-3.5" />
          <span>PDF İndir</span>
        </a>
        <AlertDialog
          open={deleteDialogOpenId === refItem.id}
          onOpenChange={(open) =>
            setDeleteDialogOpenId(open ? refItem.id : null)
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
                &ldquo;<strong>{refItem.title}</strong>&rdquo; isimli makaleyi
                ve bu makaleye ait tüm okuma notlarını, RAG parçalarını,
                görevleri ve yapay zeka analizlerini kalıcı olarak silmek
                istediğinize emin misiniz? Bu işlem geri alınamaz.
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
                  handleDeleteReference(refItem.id);
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
}
