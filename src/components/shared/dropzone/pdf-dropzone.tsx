"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { UploadCloud, FileText, AlertCircle, Sparkles, Layers, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type PdfStatus = "NOT_UPLOADED" | "PROCESSING" | "READY" | "FAILED";

export interface UnifiedPdfDropzoneProps {
  // Compact / controlled mode (legacy pdf-dropzone)
  selectedFile?: File | null;
  onFileSelect?: (file: File) => void;
  isSubmitting?: boolean;
  statusMessage?: string;
  // Hero / self-managed upload mode (legacy pdf-upload-dropzone)
  resourceTitle?: string;
  pdfStatus?: PdfStatus;
  onUploadPdf?: (file: File) => Promise<boolean>;
  className?: string;
  variant?: "compact" | "hero";
}

/**
 * Unified PDF dropzone supporting both compact (controlled) and hero (self-managed)
 * layouts. Consolidates drag-over handling, file validation and shared Tailwind styling.
 *
 * @param props - Unified dropzone props.
 * @returns Dropzone markup.
 */
export function UnifiedPdfDropzone({
  selectedFile = null,
  onFileSelect,
  isSubmitting = false,
  statusMessage = "",
  resourceTitle = "",
  pdfStatus = "NOT_UPLOADED",
  onUploadPdf,
  className,
  variant,
}: UnifiedPdfDropzoneProps) {
  const resolvedVariant: "compact" | "hero" =
    variant ?? (onUploadPdf || resourceTitle ? "hero" : "compact");

  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndHandle = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Lütfen geçerli bir PDF dosyası yükleyiniz.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("PDF dosya boyutu maksimum 25MB olabilir.");
      return;
    }
    if (onUploadPdf) {
      try {
        setIsUploading(true);
        const ok = await onUploadPdf(file);
        if (ok) toast.success("PDF başarıyla yüklendi, metin ayrıştırıldı ve RAG için vektörleştirildi.");
      } finally {
        setIsUploading(false);
      }
      return;
    }
    onFileSelect?.(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void validateAndHandle(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void validateAndHandle(file);
    // reset so same file can be re-selected
    if (e.target) e.target.value = "";
  };

  const isProcessing = isSubmitting || isUploading || pdfStatus === "PROCESSING";

  // ── HERO variant (pdf-upload-dropzone) ────────────────────────────────
  if (resolvedVariant === "hero") {
    return (
      <div className={cn("flex flex-1 min-h-0 flex-col justify-between gap-4", className)}>
        <Card
          className={cn(
            "flex-1 flex flex-col justify-center items-center border border-dashed transition-all relative overflow-hidden",
            isDragOver ? "border-primary bg-primary/10 shadow-inner" : "border-border/80 bg-muted/10 hover:bg-muted/20 hover:border-border",
          )}
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
              onChange={handleInputChange}
            />
            {isProcessing ? (
              <div className="flex w-full flex-col items-center space-y-4 py-8">
                <LoadingSpinner size="lg" className="min-h-0" />
                <div className="space-y-1.5 max-w-sm text-center">
                  <p className="font-serif text-sm font-semibold tracking-tight text-foreground">
                    PDF Dokümanı İşleniyor ve İndeksleniyor
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Metin katmanı ayrıştırılıyor, Cloudflare R2 bulut arşivine aktarılıyor ve anlamsal arama için
                    vektörleştiriliyor.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-primary shadow-xs transition-transform hover:scale-105">
                  <UploadCloud className="size-8" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">PDF Dokümanı Yükle</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">&quot;{resourceTitle}&quot;</span> eserine ait tam metin
                    PDF dosyasını buraya sürükleyip bırakın veya cihazınızdan seçin.
                  </p>
                </div>
                {pdfStatus === "FAILED" && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>Son yükleme denemesi başarısız oldu. Lütfen tekrar deneyiniz.</span>
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
                  <span className="text-[11px] text-muted-foreground font-mono">Maksimum 25 MB • Yalnızca PDF formatı</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-card/50 border border-border/50 text-left">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 mt-0.5">
              <Layers className="size-3.5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h4 className="text-xs font-medium text-foreground">Metin & OCR Ayrıştırma</h4>
              <p className="text-[11px] text-muted-foreground leading-snug">Sayfa yapısı ve akademik metin blokları taranır.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-card/50 border border-border/50 text-left">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 mt-0.5">
              <Database className="size-3.5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h4 className="text-xs font-medium text-foreground">Cloudflare R2 Arşivi</h4>
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
              <h4 className="text-xs font-medium text-foreground">BGE-M3 Vektör & RAG</h4>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Anlamsal arama ve 5 boyutlu yapay zeka analizi aktifleşir.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── COMPACT variant (legacy pdf-dropzone) ─────────────────────────────
  return (
    <Card className={cn("border border-dashed border-border bg-muted/20 mt-1", className)}>
      <CardContent
        onDragOver={(e) => {
          e.preventDefault();
          if (!isProcessing) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center p-6 text-center transition-all",
          isDragOver && "bg-accent/20 border-primary",
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="application/pdf"
          className="hidden"
          aria-label="Akademik PDF dosyası seçin"
          disabled={isProcessing}
          onChange={handleInputChange}
        />
        {isProcessing ? (
          <div className="flex w-full flex-col items-center">
            <LoadingSpinner size="sm" className="min-h-0 py-4" />
            <div className="space-y-1">
              <p className="font-sans text-sm font-semibold text-foreground">Klasik Kaynak Yükleme Pipeline Çalışıyor...</p>
              <p className="text-xs text-muted-foreground">
                {statusMessage || "PDF künyesi çıkarılıp Cloudflare R2'ye yükleniyor, Cloudflare AI & Neon pgvector ile vektörleştiriliyor."}
              </p>
            </div>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center space-y-2 py-1">
            <div className="p-3 rounded-full bg-success/10 border border-success/20 text-success">
              <FileText className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground truncate max-w-xs">{selectedFile.name}</p>
              <p className="text-[10px] text-muted-foreground">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-primary h-7 px-2 hover:bg-primary/10"
            >
              Farklı PDF Seç
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2 py-2">
            <div className="p-3 rounded-full bg-primary/10 border border-primary/20 text-primary">
              <UploadCloud className="h-7 w-7" />
            </div>
            <div className="space-y-1 max-w-xs">
              <p className="text-xs font-semibold text-foreground">PDF Dosyasını Buraya Sürükleyin</p>
              <p className="text-[11px] text-muted-foreground">veya bilgisayarınızdan seçmek için aşağıdaki butona tıklayın.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 text-xs font-medium mt-1"
            >
              <FileText className="h-4 w-4 text-primary" />
              PDF Seç
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Back-compat named exports for direct migration
export type PdfDropzoneProps = UnifiedPdfDropzoneProps;
export type PdfUploadDropzoneProps = UnifiedPdfDropzoneProps;
