"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

interface AddSectionModalProps {
  open: boolean;
  parentId: number | null;
  parentTitle?: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string }) => void;
}

/**
 * Add-section dialog with its own title/description inputs, reset on open and
 * ⌘/Ctrl + Enter quick-save support.
 *
 * @param root0 - Component props.
 * @param root0.open - Whether the dialog is visible.
 * @param root0.parentId - Parent section id when adding a sub-section.
 * @param root0.parentTitle - Parent section title for the hierarchy preview.
 * @param root0.isSaving - Whether the create request is in flight.
 * @param root0.onClose - Dialog close handler.
 * @param root0.onSubmit - Create handler receiving the validated input.
 */
export function AddSectionModal({
  open,
  parentId,
  parentTitle,
  isSaving,
  onClose,
  onSubmit,
}: AddSectionModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Bölüm başlığı boş bırakılamaz.");
      return;
    }
    onSubmit({ title, description });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-base font-semibold text-foreground">
            {parentId ? "Yeni Alt Bölüm Ekle" : "Yeni Ana Bölüm Ekle"}
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            {parentId
              ? "Seçtiğiniz ana bölümün altına yeni bir alt araştırma başlığı ekleyin."
              : "Tezinizin ana omurgasına yeni bir ana bölüm ekleyin."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Parent Selection if not locked */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Hiyerarşi Konumu
            </label>
            <div className="p-2.5 rounded-md bg-muted/40 border border-border/60 text-xs font-sans text-muted-foreground">
              {parentId ? (
                <span>
                  Ana Bölüm:{" "}
                  <strong className="text-foreground">
                    {parentTitle ?? "Seçili Bölüm"}
                  </strong>
                </span>
              ) : (
                <span className="text-primary font-medium">
                  ✓ Bağımsız Ana Bölüm (1. Düzey Başlık)
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Bölüm Başlığı <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: 2.1. Hegemonya ve Karşı-Hegemonya Kavramı"
              className="text-xs"
            />
          </div>

          {/* Description / Scope */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Yazım Kapsamı & Tartışma Odağı (Opsiyonel)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Bu bölümde tartışılacak temel argümanları ve problematiği özetleyin..."
              rows={4}
              className="textarea-academic w-full text-xs"
            />
            <span className="text-[11px] text-muted-foreground block pt-0.5">
              ⌘ + Enter ile hızlı kaydet
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
          >
            İptal
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSaving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1.5" />
            )}
            <span>Bölümü Oluştur</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
