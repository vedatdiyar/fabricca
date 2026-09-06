"use client";

import * as React from "react";
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
import { cn } from "@/lib/utils";
import type { PdfStatus } from "./pdf-dropzone";

interface HeroDropzoneFeaturesProps {
  className?: string;
}

export function HeroDropzoneFeatures({ className }: HeroDropzoneFeaturesProps) {
  return (
    <div
      className={cn("grid grid-cols-1 md:grid-cols-3 gap-3 pt-1", className)}
    >
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
  );
}

export interface HeroDropzoneProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isDragOver: boolean;
  setIsDragOver: (val: boolean) => void;
  isProcessing: boolean;
  multiple?: boolean;
  pdfStatus?: PdfStatus;
  resourceTitle?: string;
  className?: string;
  onDrop: (e: React.DragEvent) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenFile: () => void;
}

export function HeroDropzone({
  fileInputRef,
  isDragOver,
  setIsDragOver,
  isProcessing,
  multiple = false,
  pdfStatus = "NOT_UPLOADED",
  resourceTitle = "",
  className,
  onDrop,
  onInputChange,
  onOpenFile,
}: HeroDropzoneProps) {
  return (
    <div
      className={cn(
        "flex flex-1 min-h-0 flex-col justify-between gap-4",
        className,
      )}
    >
      <Card
        className={cn(
          "flex-1 flex flex-col justify-center items-center border border-dashed transition-all relative overflow-hidden",
          isDragOver
            ? "border-primary bg-primary/10 shadow-inner"
            : "border-border/80 bg-muted/10 hover:bg-muted/20 hover:border-border",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
      >
        <CardContent className="flex flex-col items-center justify-center p-6 sm:p-10 text-center w-full max-w-xl">
          <input
            type="file"
            ref={fileInputRef}
            accept="application/pdf"
            multiple={multiple}
            className="hidden"
            aria-label="PDF dosyası seçin"
            onChange={onInputChange}
          />
          {isProcessing ? (
            <div className="flex w-full flex-col items-center space-y-4 py-8">
              <LoadingSpinner size="lg" className="min-h-0" />
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
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-primary shadow-xs transition-transform hover:scale-105">
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
                  onClick={onOpenFile}
                  className="gap-2 text-xs font-medium px-4 h-8 cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  Cihazdan PDF Seç
                </Button>
                <span className="text-[11px] text-muted-foreground font-mono">
                  Maksimum 25 MB • Yalnızca PDF formatı
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <HeroDropzoneFeatures />
    </div>
  );
}
