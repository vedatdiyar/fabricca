"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PdfUploadDropzoneProps {
  /** Resource title */
  resourceTitle: string;
  /** Current PDF status */
  pdfStatus?: "NOT_UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  /** Callback fired when user selects and submits a PDF file */
  onUploadPdf: (file: File) => Promise<void>;
}

/**
 * Dropzone component for uploading PDF documents and triggering RAG vectorization.
 */
export function PdfUploadDropzone({
  resourceTitle,
  pdfStatus = "NOT_UPLOADED",
  onUploadPdf,
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
      await onUploadPdf(file);
      toast.success(
        "PDF başarıyla yüklendi, metin ayrıştırıldı ve RAG için vektörleştirildi.",
      );
    } catch {
      toast.error("PDF yüklenirken bir hata oluştu.");
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
    <Card className="border border-dashed border-border bg-muted/20 my-4">
      <CardContent
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-8 text-center transition-all ${
          isDragOver ? "bg-accent/60 border-primary" : ""
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileSelect(e.target.files[0]);
            }
          }}
        />

        {isUploading || pdfStatus === "PROCESSING" ? (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="font-sans text-sm font-semibold text-foreground">
                PDF Dokümanı İşleniyor ve Yükleniyor...
              </p>
              <p className="text-xs text-muted-foreground">
                Boyut kontrolü yapılıyor, gerekirse iLovePDF ile optimize edilip
                R2 bulut depolamaya aktarılıyor.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <div className="p-3 rounded-full bg-primary/10 border border-primary/20 text-primary">
              <UploadCloud className="h-8 w-8" />
            </div>

            <div className="space-y-1 max-w-md">
              <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground">
                PDF Dokümanı Yükle
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">
                  &quot;{resourceTitle}&quot;
                </span>{" "}
                eserine ait PDF dosyasını buraya sürükleyip bırakın veya
                cihazınızdan seçin.
              </p>
            </div>

            {pdfStatus === "FAILED" && (
              <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <span>
                  Son yükleme denemesi başarısız oldu. Lütfen tekrar deneyiniz.
                </span>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 text-xs font-medium mt-2"
            >
              <FileText className="h-4 w-4 text-primary" />
              Cihazdan PDF Seç
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
