"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmDialogProps {
  noteToDeleteId: number | null;
  onCloseNoteDeleteDialog: () => void;
  onConfirmDeleteNote: () => void;
  pdfToDeleteId: number | null;
  onClosePdfDeleteDialog: () => void;
  onConfirmDeletePdf: () => void;
}

/**
 * Confirmation dialogs for note deletion and PDF deletion.
 *
 * @param root0 - Component props.
 * @param root0.noteToDeleteId - ID of the note pending deletion, or null if closed.
 * @param root0.onCloseNoteDeleteDialog - Callback to close note deletion dialog.
 * @param root0.onConfirmDeleteNote - Callback to confirm note deletion.
 * @param root0.pdfToDeleteId - ID of the PDF pending deletion, or null if closed.
 * @param root0.onClosePdfDeleteDialog - Callback to close PDF deletion dialog.
 * @param root0.onConfirmDeletePdf - Callback to confirm PDF deletion.
 * @returns The delete confirmation dialogs markup.
 */
export function DeleteConfirmDialog({
  noteToDeleteId,
  onCloseNoteDeleteDialog,
  onConfirmDeleteNote,
  pdfToDeleteId,
  onClosePdfDeleteDialog,
  onConfirmDeletePdf,
}: DeleteConfirmDialogProps) {
  return (
    <>
      <AlertDialog
        open={noteToDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) onCloseNoteDeleteDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Notu Silmek İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bu akademik not ve alıntı fişlerinizden kalıcı olarak
              silinecektir. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Evet, Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pdfToDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) onClosePdfDeleteDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              PDF&apos;i Silmek İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bu PDF ve ilişkili tüm vektör verileri kalıcı olarak silinecektir.
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-medium">
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDeletePdf}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium"
            >
              Evet, Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
