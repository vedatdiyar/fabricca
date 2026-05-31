"use client";

import React, { useRef, useState } from "react";
import { Upload, X, Loader2, AlertCircle, Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LiteratureRecommendation } from "../actions";
import { uploadPdfAction } from "@/app/library/actions";

interface PdfUploadDrawerProps {
  selectedRec: LiteratureRecommendation | null;
  onClose: () => void;
}

export function PdfUploadDrawer({
  selectedRec,
  onClose,
}: PdfUploadDrawerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

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

      const result = await uploadPdfAction(
        formData,
        selectedRec
          ? {
              title: selectedRec.title,
              authors: selectedRec.authors || "Bilinmeyen Yazar",
              year: Number(selectedRec.year) || new Date().getFullYear(),
            }
          : undefined,
      );

      if (result.success) {
        setUploadSuccess(
          "Dosya kütüphaneye eklendi, metin analizi ve indeksleme arka planda başlatıldı.",
        );
        // Automatically close the drawer after 1.5 seconds on successful upload
        setTimeout(() => {
          onClose();
          // Reset status for next time
          setUploadSuccess(null);
        }, 1500);
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

  // Reset local states when drawer opens/closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      // Reset status on close
      setUploadError(null);
      setUploadSuccess(null);
    }
  };

  const renderDropZoneContent = () => {
    if (isUploading) {
      return (
        <div className="flex flex-col items-center space-y-3 py-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-xs font-semibold text-primary">
            Dosya R2 bulut deposuna aktarılıyor...
          </p>
          <p className="text-[10px] text-muted-foreground">
            Lütfen tarayıcıyı kapatmayın
          </p>
        </div>
      );
    }

    return (
      <>
        <div
          className={`size-12 rounded-full bg-secondary border border-border flex items-center justify-center transition duration-150 ${
            isDragging
              ? "border-primary text-primary"
              : "group-hover:border-primary"
          }`}
        >
          <Upload
            className={`size-5 transition duration-150 ${
              isDragging
                ? "text-primary"
                : "text-muted-foreground group-hover:text-primary"
            }`}
          />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground">
            {isDragging
              ? "PDF Dosyasını Bırakın"
              : "PDF Seç veya Sürükle-Bırak"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            .pdf — Maks. 20MB
          </p>
        </div>
      </>
    );
  };

  return (
    <Drawer open={selectedRec !== null} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            <Upload className="size-4 text-primary" />
            <span>PDF Yükle</span>
          </DrawerTitle>
          <DrawerClose>
            <X className="size-4" />
          </DrawerClose>
        </DrawerHeader>
        <div className="flex flex-col flex-1 p-5 space-y-5 overflow-y-auto">
          {/* Siber-akademik uyarı */}
          <div className="bg-background border border-border rounded-lg p-4 space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Bu makaleyi Danışman Odası&apos;nda kuramsal tartışmaya açmak için
              tam metin PDF dosyası gereklidir. Lütfen kaynağın resmi
              sayfasından indirdiğiniz PDF&apos;i aşağıya yükleyin.
            </p>
          </div>

          {/* Seçili kaynak künyesi */}
          {selectedRec && (
            <div className="bg-background border-l-2 border-primary pl-3 py-2 space-y-1">
              <p className="text-xs text-foreground font-bold leading-snug">
                {selectedRec.title}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {selectedRec.authors} ({selectedRec.year})
              </p>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={inputRef}
            onChange={onFileChange}
            accept="application/pdf"
            className="hidden"
            aria-label="PDF formatında akademik makale yükleme girdisi"
          />

          {/* Functional Dropzone */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => !isUploading && inputRef.current?.click()}
            onKeyDown={(e) => {
              if (!isUploading && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!isUploading) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (isUploading) return;
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className={`flex-1 border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 text-center transition duration-150 cursor-pointer group bg-background ${
              isDragging
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
            } ${isUploading ? "cursor-not-allowed opacity-80" : ""}`}
          >
            {renderDropZoneContent()}
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

          {/* Ingestion Info */}
          <p className="text-[9px] text-muted-foreground text-center">
            Yüklenen dosya LlamaParse ile ayrıştırılıp Gemini & pgvector ile
            RAG kütüphanenize dahil edilir.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
