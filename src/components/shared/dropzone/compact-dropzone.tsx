"use client";

import * as React from "react";
import { UploadCloud, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { cn } from "@/lib/utils";

export interface CompactDropzoneProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isDragOver: boolean;
  setIsDragOver: (val: boolean) => void;
  isProcessing: boolean;
  multiple?: boolean;
  selectedFile?: File | null;
  statusMessage?: string;
  className?: string;
  onDrop: (e: React.DragEvent) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenFile: () => void;
}

export function CompactDropzone({
  fileInputRef,
  isDragOver,
  setIsDragOver,
  isProcessing,
  multiple = false,
  selectedFile = null,
  statusMessage = "",
  className,
  onDrop,
  onInputChange,
  onOpenFile,
}: CompactDropzoneProps) {
  return (
    <Card
      className={cn(
        "border border-dashed border-border bg-muted/20 mt-1",
        className,
      )}
    >
      <CardContent
        onDragOver={(e) => {
          e.preventDefault();
          if (!isProcessing) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center p-6 text-center transition-all",
          isDragOver && "bg-accent/20 border-primary",
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="application/pdf"
          multiple={multiple}
          className="hidden"
          aria-label="Akademik PDF dosyası seçin"
          disabled={isProcessing}
          onChange={onInputChange}
        />
        {isProcessing ? (
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
              onClick={onOpenFile}
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
                {multiple
                  ? "PDF Dosyalarını Buraya Sürükleyin"
                  : "PDF Dosyasını Buraya Sürükleyin"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {multiple
                  ? "Tek seferde birden fazla PDF seçebilirsiniz."
                  : "veya bilgisayarınızdan seçmek için aşağıdaki butona tıklayın."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenFile}
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
