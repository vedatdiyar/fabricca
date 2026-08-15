"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import type { BoxWithRelations } from "../../constants/quadrant-config";

interface DeleteSubBoxModalProps {
  open: boolean;
  box: BoxWithRelations;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => Promise<boolean> | void;
}

/** Delete confirmation dialog for a sub-box. */
export function DeleteSubBoxModal({
  open,
  box,
  isDeleting,
  onOpenChange,
  onDelete,
}: DeleteSubBoxModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 gap-4 bg-card border-border">
        <DialogHeader className="space-y-1 pb-2 border-b border-border/40">
          <DialogTitle className="font-serif text-base font-semibold text-destructive flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            <span>Alt Konuyu Sil</span>
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            Bu alt konuyu ve ilişkili kavram havuzunu silmek istediğinizden emin misiniz?
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs space-y-1">
          <p className="font-semibold text-destructive">
            &quot;{box.title}&quot;
          </p>
          <p className="text-muted-foreground text-[11px]">
            Bu işlem geri alınamaz. Ancak kutuya bağlı kaynaklar ve görevler veri güvenliği için kütüphanede korunacaktır.
          </p>
        </div>

        <DialogFooter className="flex items-center justify-between pt-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="text-xs"
          >
            Vazgeç
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void onDelete()}
            disabled={isDeleting}
            className="text-xs font-medium gap-1.5"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            <span>Evet, Sil</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
