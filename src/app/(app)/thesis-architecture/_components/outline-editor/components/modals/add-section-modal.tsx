"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { FormDialog } from "@/components/shared/dialog/form-dialog";
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
    <FormDialog
      open={open}
      onOpenChange={onClose}
      title={parentId ? "Yeni Alt Bölüm Ekle" : "Yeni Ana Bölüm Ekle"}
      description={
        parentId
          ? "Seçtiğiniz ana bölümün altına yeni bir alt araştırma başlığı ekleyin."
          : "Tezinizin ana omurgasına yeni bir ana bölüm ekleyin."
      }
      size="lg"
      isSaving={isSaving}
      saveLabel="Bölümü Oluştur"
      saveIcon={Plus}
      onSave={handleSubmit}
      showSeparator={false}
      footerLayout="end"
    >
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
              placeholder="Örn: 2.1. Kuramsal Yaklaşımlar ve Temel Kavramsal Çerçeve"
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
              className="w-full text-xs"
            />
          </div>
    </FormDialog>
  );
}
