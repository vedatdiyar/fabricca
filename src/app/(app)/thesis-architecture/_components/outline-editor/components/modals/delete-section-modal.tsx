"use client";

import { Outline } from "@/db/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";

interface DeleteSectionModalProps {
  open: boolean;
  outline: Outline | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Delete confirmation dialog for a section and its dependent sub-sections.
 *
 * @param root0 - Component props.
 * @param root0.open - Whether the dialog is visible.
 * @param root0.outline - The section pending deletion or null.
 * @param root0.isDeleting - Whether the delete request is in flight.
 * @param root0.onClose - Dialog close handler.
 * @param root0.onConfirm - Delete confirmation handler.
 */
export function DeleteSectionModal({
  open,
  outline,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteSectionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-base font-semibold text-destructive">
            Bölümü Silmek İstediğinize Emin Misiniz?
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground pt-1">
            &quot;{outline?.title}&quot; bölümü ve bu bölüme bağlı tüm alt
            başlıklar, kaynak bağlantıları kalıcı olarak silinecektir.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
          >
            Vazgeç
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            <span>Kalıcı Olarak Sil</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
