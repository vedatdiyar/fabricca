"use client";

import React, { useState } from "react";
import { UploadCloud, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useBoxHierarchySelection } from "../_hooks/use-box-hierarchy-selection";
import { AddResourceBoxSelector } from "./add-resource-box-selector";
import { PdfDropzone } from "./pdf-dropzone";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const {
    hierarchy,
    hierarchyError,
    selectedParentId,
    selectedSubBoxId,
    setParentId,
    setSubBoxId,
    isLoading: isLoadingBoxes,
  } = useBoxHierarchySelection();

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

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent
        className="max-w-2xl rounded-lg"
        onEscapeKeyDown={(e) => isSubmitting && e.preventDefault()}
        onInteractOutside={(e) => isSubmitting && e.preventDefault()}
      >
        <DialogHeader className="space-y-1 pb-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="size-3.5" />
            </div>
          </div>
          <DialogTitle className="font-serif text-base font-semibold tracking-tight text-foreground">
            Yeni Akademik PDF Yükle
          </DialogTitle>
        </DialogHeader>
        <Separator />

        <form onSubmit={handleSubmit} className="space-y-4">
          <AddResourceBoxSelector
            parentBoxes={parentBoxes}
            isLoading={isLoadingBoxes}
            hierarchyError={hierarchyError}
            selectedParentId={selectedParentId}
            selectedSubBoxId={selectedSubBoxId}
            onParentSelect={setParentId}
            onSubBoxSelect={setSubBoxId}
            disabled={isSubmitting}
          />

          {hasSubBoxes && selectedParent && (
            <div className="space-y-1">
              <Label className="text-xs text-foreground font-medium">
                Alt Kutu
              </Label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {selectedParent.children.map((child) => (
                  <button
                    type="button"
                    key={child.id}
                    disabled={isSubmitting}
                    onClick={() => setSubBoxId(child.id)}
                    className={cn(
                      "px-3 py-2 text-xs rounded-md border text-left",
                      selectedSubBoxId === child.id
                        ? "font-semibold border-primary/20 bg-accent/20 text-foreground"
                        : "font-medium border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
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
            <PdfDropzone
              selectedFile={selectedFile}
              onFileSelect={handleFileChange}
              isSubmitting={isSubmitting}
              statusMessage={statusMessage}
            />
          </div>

          <Separator />
          <div className="flex items-center justify-end gap-2 pt-2">
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
      </DialogContent>
    </Dialog>
  );
}
