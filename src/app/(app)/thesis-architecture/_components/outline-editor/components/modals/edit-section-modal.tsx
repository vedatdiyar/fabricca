"use client";

import { useState } from "react";
import { Outline } from "@/core/db/schema";
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
import { Check, Loader2 } from "lucide-react";
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-semibold text-foreground">
            Bölümü Düzenle
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            Bölüm başlığını, sırasını ve kapsam tanımını güncelleyin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-medium text-foreground">
              Bölüm Başlığı <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-xs"
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
              className="h-9 text-xs font-mono"
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
              <Check className="h-3.5 w-3.5 mr-1.5" />
            )}
            <span>Değişiklikleri Kaydet</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
