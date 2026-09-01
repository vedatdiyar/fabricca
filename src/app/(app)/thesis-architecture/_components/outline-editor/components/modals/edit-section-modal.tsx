"use client";

import { useState } from "react";
import { Outline } from "@/core/db/schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";
import { FormDialog } from "@/components/shared/dialog/form-dialog";
import { toast } from "sonner";

interface EditSectionModalProps {
  open: boolean;
  outline: Outline | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    sortOrder: number;
  }) => void;
}

/**
 * Edit-section dialog with its own title/description/sort-order inputs,
 * populated from the target outline on open and ⌘/Ctrl + Enter quick-save.
 *
 * @param root0 - Component props.
 * @param root0.open - Whether the dialog is visible.
 * @param root0.outline - The section being edited or null.
 * @param root0.isSaving - Whether the update request is in flight.
 * @param root0.onClose - Dialog close handler.
 * @param root0.onSubmit - Update handler receiving the edited input.
 */
export function EditSectionModal({
  open,
  outline,
  isSaving,
  onClose,
  onSubmit,
}: EditSectionModalProps) {
  const [title, setTitle] = useState(outline?.title ?? "");
  const [description, setDescription] = useState(outline?.description ?? "");
  const [sortOrder, setSortOrder] = useState<number>(outline?.sortOrder ?? 1);

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Bölüm başlığı boş bırakılamaz.");
      return;
    }
    onSubmit({ title, description, sortOrder });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onClose}
      title="Bölümü Düzenle"
      description="Bölüm başlığını, sırasını ve kapsam tanımını güncelleyin."
      size="lg"
      isSaving={isSaving}
      saveLabel="Değişiklikleri Kaydet"
      saveIcon={Check}
      onSave={handleSubmit}
      showSeparator={false}
      footerLayout="end"
    >
          {/* Title */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Bölüm Başlığı <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Sort Order */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Sıralama İndeksi
            </label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="text-xs font-mono"
            />
          </div>

          {/* Description / Scope */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Yazım Kapsamı & Tartışma Odağı
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
              rows={5}
              className="w-full text-xs"
            />
          </div>
    </FormDialog>
  );
}
