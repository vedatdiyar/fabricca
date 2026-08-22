"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  AlertCircle,
  Sparkles,
  Layers,
  Database,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "sonner";

interface PdfUploadDropzoneProps {
  /** Resource title. */
  resourceTitle: string;
  /** Current PDF status. */
  pdfStatus?: "NOT_UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  /** Callback fired when user selects and submits a PDF file. */
  onUploadPdf: (file: File) => Promise<boolean>;
  /** Optional custom class name */
  className?: string;
}

/**
 * Dropzone component for uploading PDF documents and triggering RAG vectorization.
 * Fills available vertical space with a hero-style drag & drop area and RAG capability badges.
 *
 * @param root0 - Component props.
 * @param root0.resourceTitle - Title of the resource the PDF belongs to.
 * @param root0.pdfStatus - Current PDF upload status.
 * @param root0.onUploadPdf - Callback invoked with the selected file for upload.
 * @param root0.className - Optional additional styling classes.
 * @returns The PDF upload dropzone markup.
 */
export function PdfUploadDropzone({
  resourceTitle,
  pdfStatus = "NOT_UPLOADED",
  onUploadPdf,
  className = "",
}: PdfUploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Lütfen geçerli bir PDF dosyası yükleyiniz.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("PDF dosya boyutu maksimum 25MB olabilir.");
      return;
    }

    try {
      setIsUploading(true);
      const isSuccess = await onUploadPdf(file);
      if (!isSuccess) {
        return;
      }
      toast.success(
        "PDF başarıyla yüklendi, metin ayrıştırıldı ve RAG için vektörleştirildi.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      className={`flex flex-1 min-h-0 flex-col justify-between gap-4 ${className}`}
    >
      <Card
        className={`flex-1 flex flex-col justify-center items-center border border-dashed transition-all relative overflow-hidden ${
          isDragOver
            ? "border-primary bg-primary/5 shadow-inner"
            : "border-border/80 bg-muted/10 hover:bg-muted/20 hover:border-border"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center p-6 sm:p-10 text-center w-full max-w-xl">
          <input
            type="file"
            ref={fileInputRef}
            accept="application/pdf"
            className="hidden"
            aria-label="PDF dosyası seçin"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
              }
            }}
          />

          {isUploading || pdfStatus === "PROCESSING" ? (
            <div className="flex w-full flex-col items-center space-y-4 py-8">
              <div className="relative flex items-center justify-center">
                <LoadingSpinner size="lg" className="min-h-0" />
              </div>
              <div className="space-y-1.5 max-w-sm text-center">
                <p className="font-serif text-sm font-semibold tracking-tight text-foreground">
                  PDF Dokümanı İşleniyor ve İndeksleniyor
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Metin katmanı ayrıştırılıyor, Cloudflare R2 bulut arşivine
                  aktarılıyor ve anlamsal arama için vektörleştiriliyor.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-xs transition-transform hover:scale-105">
                <UploadCloud className="size-8" />
              </div>

              <div className="space-y-1.5 max-w-md">
                <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">
                  PDF Dokümanı Yükle
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">
                    &quot;{resourceTitle}&quot;
                  </span>{" "}
                  eserine ait tam metin PDF dosyasını buraya sürükleyip bırakın
                  veya cihazınızdan seçin.
                </p>
              </div>

              {pdfStatus === "FAILED" && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>
                    Son yükleme denemesi başarısız oldu. Lütfen tekrar
                    deneyiniz.
                  </span>
                </div>
              )}

              <div className="pt-2 flex flex-col items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 text-xs font-medium px-4 h-8 cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  Cihazdan PDF Seç
                </Button>
                <span className="text-[11px] text-muted-foreground/70 font-mono">
                  Maksimum 25 MB • Yalnızca PDF formatı
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RAG & Processing Capabilities Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-card/50 border border-border/50 text-left">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 mt-0.5">
            <Layers className="size-3.5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h4 className="text-xs font-medium text-foreground">
              Metin & OCR Ayrıştırma
            </h4>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Sayfa yapısı ve akademik metin blokları taranır.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-card/50 border border-border/50 text-left">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 mt-0.5">
            <Database className="size-3.5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h4 className="text-xs font-medium text-foreground">
              Cloudflare R2 Arşivi
            </h4>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Yüksek güvenlikli bulut depolama ile her an erişilebilir.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-card/50 border border-border/50 text-left">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 mt-0.5">
            <Sparkles className="size-3.5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h4 className="text-xs font-medium text-foreground">
              BGE-M3 Vektör & RAG
            </h4>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Anlamsal arama ve 5 boyutlu yapay zeka analizi aktifleşir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
