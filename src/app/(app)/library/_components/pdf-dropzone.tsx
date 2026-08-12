"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

interface PdfDropzoneProps {
  /** Currently selected PDF file, or null when none is chosen. */
  selectedFile: File | null;
  /** Callback fired with a newly selected PDF file. */
  onFileSelect: (file: File) => void;
  /** Whether the upload pipeline is running. */
  isSubmitting: boolean;
  /** Live pipeline status message shown while submitting. */
  statusMessage: string;
}

/**
 * Drag & drop PDF picker for the add-resource flow, rendering the idle dropzone,
 * the selected-file card and the processing state.
 *
 * @param root0 - Component props.
 * @param root0.selectedFile - The currently selected PDF file.
 * @param root0.onFileSelect - Callback invoked with a chosen file.
 * @param root0.isSubmitting - Whether the upload pipeline is running.
 * @param root0.statusMessage - Live pipeline status message.
 * @returns The PDF dropzone markup.
 */
export function PdfDropzone({
  selectedFile,
  onFileSelect,
  isSubmitting,
  statusMessage,
}: PdfDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <Card className="border border-dashed border-border bg-muted/20 mt-1">
      <CardContent
        onDragOver={(e) => {
          e.preventDefault();
          if (!isSubmitting) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-6 text-center transition-all ${
          isDragOver ? "bg-accent/20 border-primary" : ""
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="application/pdf"
          className="hidden"
          aria-label="Akademik PDF dosyası seçin"
          disabled={isSubmitting}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFileSelect(e.target.files[0]);
            }
          }}
        />

        {isSubmitting ? (
          <div className="flex w-full flex-col items-center">
            <LoadingSpinner size="sm" className="min-h-0 py-4" />
            <div className="space-y-1">
              <p className="font-sans text-sm font-semibold text-foreground">
                Klasik Kaynak Yükleme Pipeline Çalışıyor...
              </p>
              <p className="text-xs text-muted-foreground">
                {statusMessage ||
                  "PDF künyesi çıkarılıp Cloudflare R2'ye yükleniyor, Cloudflare AI & Neon pgvector ile vektörleştiriliyor."}
              </p>
            </div>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center space-y-2 py-1">
            <div className="p-3 rounded-full bg-success/10 border border-success/20 text-success">
              <FileText className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground truncate max-w-xs">
                {selectedFile.name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
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
              <p className="text-xs font-semibold text-foreground">
                PDF Dosyasını Buraya Sürükleyin
              </p>
              <p className="text-[11px] text-muted-foreground">
                veya bilgisayarınızdan seçmek için aşağıdaki butona tıklayın.
              </p>
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
