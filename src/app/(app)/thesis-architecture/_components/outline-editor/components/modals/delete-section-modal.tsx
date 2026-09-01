"use client";

import { Outline } from "@/core/db/schema";
import { Trash2 } from "lucide-react";
import { FormDialog } from "@/components/shared/dialog/form-dialog";

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
    <FormDialog
      open={open}
      onOpenChange={onClose}
      title="Bölümü Silmek İstediğinize Emin Misiniz?"
      titleClassName="text-destructive"
      description={`"${outline?.title ?? ""}" bölümü ve bu bölüme bağlı tüm alt başlıklar, kaynak bağlantıları kalıcı olarak silinecektir.`}
      descriptionClassName="pt-1"
      size="sm"
      isSaving={isDeleting}
      saveLabel="Kalıcı Olarak Sil"
      saveIcon={Trash2}
      saveVariant="destructive"
      cancelLabel="Vazgeç"
      cancelVariant="outline"
      onSave={onConfirm}
      showSeparator={false}
      footerLayout="end"
      footerClassName="pt-2"
      hideFooter={false}
    />
  );
}
