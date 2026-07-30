"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  X,
  FileText,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import type { ThesisBoxType } from "../_types/types";

interface AddResourceModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close modal */
  onClose: () => void;
  /** Callback to submit new resource via PDF upload with metadata extraction */
  onSubmitPdf: (
    file: File,
    boxType: Exclude<ThesisBoxType, "ALL">,
  ) => Promise<void>;
}

const BOX_OPTIONS: { id: Exclude<ThesisBoxType, "ALL">; label: string }[] = [
  { id: "THEORETICAL_FRAMEWORK", label: "Kuramsal Çerçeve" },
  { id: "METHODOLOGY", label: "Metodoloji" },
  { id: "SUBJECT_PROBLEM", label: "Konu ve Problem" },
  { id: "PRIMARY_MATERIAL", label: "Birincil Malzeme" },
];

/**
 * Modal component for adding new academic literature resources by uploading PDF documents.
 * Extracts metadata (title, authors, publication year, publisher, DOI) via Unstructured + Crossref/Gemini
 * and vectorizes content through the RAG pipeline.
 */
export function AddResourceModal({
  isOpen,
  onClose,
  onSubmitPdf,
}: AddResourceModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [boxType, setBoxType] = useState<Exclude<ThesisBoxType, "ALL">>(
    "THEORETICAL_FRAMEWORK",
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Lütfen yalnızca geçerli bir PDF dosyası seçiniz.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("PDF dosya boyutu maksimum 25MB olabilir.");
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast.error("Lütfen eklenecek akademik PDF dosyasını seçiniz.");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage("PDF künye bilgileri çıkarılıyor...");

      await onSubmitPdf(selectedFile, boxType);

      toast.success("Akademik eser başarıyla eklendi ve vektörleştirildi.");
      setSelectedFile(null);
      setStatusMessage("");
      onClose();
    } catch {
      toast.error("PDF yükleme ve künye çıkarma sırasında bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
      setStatusMessage("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-lg rounded-md border border-border bg-background p-6 shadow-lg space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                Yeni Akademik PDF Yükle
              </h2>
              <p className="text-xs text-muted-foreground">
                Unstructured + Crossref/Gemini ile otomatik künye (yazar,
                başlık, yıl, DOI) ayıklama
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-sm opacity-70 hover:opacity-100 p-1 text-muted-foreground hover:bg-muted disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Konu Kutusu (Box Type) Select */}
          <div className="space-y-1">
            <Label className="text-xs text-foreground font-medium">
              Konu Kutusu (Box) *
            </Label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {BOX_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  disabled={isSubmitting}
                  onClick={() => setBoxType(opt.id)}
                  className={
                    boxType === opt.id
                      ? "px-3 py-2 text-xs font-semibold rounded-md border border-primary/60 bg-accent text-foreground shadow-sm"
                      : "px-3 py-2 text-xs font-medium rounded-md border border-border bg-background text-muted-foreground hover:bg-muted"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* PDF Dropzone */}
          <div className="space-y-1">
            <Label className="text-xs text-foreground font-medium">
              Akademik PDF Dokümanı *
            </Label>
            <Card className="border border-dashed border-border bg-muted/20 mt-1">
              <CardContent
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isSubmitting) setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center p-6 text-center transition-all ${
                  isDragOver ? "bg-accent/60 border-primary" : ""
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="application/pdf"
                  className="hidden"
                  disabled={isSubmitting}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />

                {isSubmitting ? (
                  <div className="flex flex-col items-center space-y-3 py-2">
                    <Loader2 className="h-9 w-9 animate-spin text-primary" />
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
                    <div className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                      <FileText className="h-7 w-7" />
                    </div>
                    <div className="space-y-0.5">
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
                        veya bilgisayarınızdan seçmek için aşağıdaki butona
                        tıklayın.
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
          </div>

          {/* Info Notice */}
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Yüklenen PDF dokümanı <strong>Unstructured</strong> ile taranıp
              Crossref/Gemini ile künye bilgileri (başlık, yazarlar, yayın yılı,
              mecrası) otomatik ayıklanacak; ardından RAG sohbeti için
              vektörleştirilecektir.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs font-medium"
            >
              İptal
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isSubmitting || !selectedFile}
              className="gap-2 text-xs font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>İşleniyor...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  <span>PDF Yükle ve Künye Çıkar</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
