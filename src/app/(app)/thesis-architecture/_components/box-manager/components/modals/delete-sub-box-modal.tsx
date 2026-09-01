"use client";

import { Trash2 } from "lucide-react";
import { FormDialog } from "@/components/shared/dialog/form-dialog";
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Alt Konuyu Sil"
      titleIcon={Trash2}
      titleClassName="text-destructive"
      description="Bu alt konuyu ve ilişkili kavram havuzunu silmek istediğinizden emin misiniz?"
      headerClassName="pb-2 border-b border-border/40"
      size="sm"
      showSeparator={false}
      isSaving={isDeleting}
      saveLabel="Evet, Sil"
      saveIcon={Trash2}
      saveVariant="destructive"
      cancelLabel="Vazgeç"
      cancelVariant="ghost"
      onSave={() => void onDelete()}
      footerLayout="spread"
      footerClassName="pt-2"
    >
      <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs space-y-1">
        <p className="font-semibold text-destructive">&quot;{box.title}&quot;</p>
        <p className="text-muted-foreground text-[11px]">
          Bu işlem geri alınamaz. Ancak kutuya bağlı kaynaklar ve görevler veri güvenliği için kütüphanede
          korunacaktır.
        </p>
      </div>
    </FormDialog>
  );
}
