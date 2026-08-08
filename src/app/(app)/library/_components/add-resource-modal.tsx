"use client";

import React, { useState, useRef, useEffect } from "react";
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
import { getBoxHierarchyForLibraryAction } from "../actions";
import type { LibraryParentBoxOption } from "../_actions/box-actions";

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitPdf: (file: File, boxId: number) => Promise<boolean>;
}

/**
 * Modal for adding a new academic literature resource by uploading a PDF, where the
 * user selects a parent thesis box (and a sub-box when present) and metadata is
 * extracted and content is vectorized through the RAG pipeline.
 *
 * @param root0 - Component props.
 * @param root0.isOpen - Whether the modal is visible.
 * @param root0.onClose - Callback invoked when the modal is closed.
 * @param root0.onSubmitPdf - Callback that uploads the selected PDF into the target box.
 * @returns The add resource modal markup, or null when closed.
 */
export function AddResourceModal({
  isOpen,
  onClose,
  onSubmitPdf,
}: AddResourceModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hierarchy, setHierarchy] = useState<LibraryParentBoxOption[] | null>(
    null,
  );
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [selectedSubBoxId, setSelectedSubBoxId] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    /**
     * Loads the parent box hierarchy for the library.
     */
    async function loadHierarchy() {
      const res = await getBoxHierarchyForLibraryAction();
      if (cancelled) return;

      if (res.success) {
        setHierarchy(res.data);
        setHierarchyError(null);
        const firstParent = res.data[0];
        if (firstParent) {
          setSelectedParentId(firstParent.id);
          setSelectedSubBoxId(
            firstParent.children.length > 0 ? firstParent.children[0].id : null,
          );
        } else {
          setSelectedParentId(null);
          setSelectedSubBoxId(null);
        }
      } else {
        setHierarchyError(res.error || "Kutu listesi yüklenirken hata oluştu.");
      }
    }

    loadHierarchy();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isLoadingBoxes = hierarchy === null && hierarchyError === null;
  const parentBoxes = hierarchy ?? [];
  const selectedParent =
    parentBoxes.find((b) => b.id === selectedParentId) ?? null;
  const hasSubBoxes = !!selectedParent && selectedParent.children.length > 0;

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

  const handleParentChange = (parentId: number) => {
    setSelectedParentId(parentId);
    const parent = parentBoxes.find((b) => b.id === parentId);
    setSelectedSubBoxId(
      parent && parent.children.length > 0 ? parent.children[0].id : null,
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast.error("Lütfen eklenecek akademik PDF dosyasını seçiniz.");
      return;
    }

    if (!selectedParentId) {
      toast.error("Lütfen bir konu kutusu seçiniz.");
      return;
    }

    if (hasSubBoxes && selectedSubBoxId === null) {
      toast.error("Lütfen kaynağın ait olduğu alt kutuyu (sub-box) seçiniz.");
      return;
    }

    const targetBoxId = hasSubBoxes
      ? (selectedSubBoxId as number)
      : selectedParentId;

    try {
      setIsSubmitting(true);
      setStatusMessage("PDF künye bilgileri çıkarılıyor...");

      const isSuccess = await onSubmitPdf(selectedFile, targetBoxId);
      if (!isSuccess) {
        return;
      }

      toast.success("Akademik eser başarıyla eklendi ve vektörleştirildi.");
      setSelectedFile(null);
      setStatusMessage("");
      onClose();
    } finally {
      setIsSubmitting(false);
      setStatusMessage("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-2xl rounded-lg border border-border bg-background p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                Yeni Akademik PDF Yükle
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-sm opacity-70 hover:opacity-100 p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-foreground font-medium">
              Konu Kutusu
            </Label>
            {isLoadingBoxes ? (
              <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Kutular yükleniyor...
              </div>
            ) : hierarchyError ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/20 border border-border text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {hierarchyError}
              </div>
            ) : parentBoxes.length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/20 border border-border text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Henüz tanımlı bir konu kutunuz bulunmuyor. Lütfen onboarding
                adımlarını tamamlayın.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {parentBoxes.map((parent) => (
                  <button
                    type="button"
                    key={parent.id}
                    disabled={isSubmitting}
                    onClick={() => handleParentChange(parent.id)}
                    className={
                      selectedParentId === parent.id
                        ? "px-3 py-2 text-xs font-semibold rounded-md border border-primary/20 bg-accent/20 text-foreground text-left"
                        : "px-3 py-2 text-xs font-medium rounded-md border border-border bg-background text-muted-foreground hover:bg-muted text-left"
                    }
                  >
                    {parent.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {hasSubBoxes && (
            <div className="space-y-1">
              <Label className="text-xs text-foreground font-medium">
                Alt Kutu
              </Label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {selectedParent?.children.map((child) => (
                  <button
                    type="button"
                    key={child.id}
                    disabled={isSubmitting}
                    onClick={() => setSelectedSubBoxId(child.id)}
                    className={
                      selectedSubBoxId === child.id
                        ? "px-3 py-2 text-xs font-semibold rounded-md border border-primary/20 bg-accent/20 text-foreground text-left"
                        : "px-3 py-2 text-xs font-medium rounded-md border border-border bg-background text-muted-foreground hover:bg-muted text-left"
                    }
                  >
                    {child.title}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                  isDragOver ? "bg-accent/20 border-primary" : ""
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
                    <div className="p-3 rounded-full bg-success/10 border border-success/20 text-success">
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
              disabled={
                isSubmitting ||
                !selectedFile ||
                isLoadingBoxes ||
                !selectedParentId ||
                (hasSubBoxes && selectedSubBoxId === null)
              }
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
