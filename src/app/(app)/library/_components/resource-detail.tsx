"use client";

import React, { useState } from "react";
import { BookMarked, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PdfUploadDropzone } from "./pdf-upload-dropzone";
import { EditResourceModal } from "./edit-resource-modal";
import { ResourceHeader } from "./resource-detail/resource-header";
import { NoteForm } from "./resource-detail/note-form";
import { NoteItem, getNoteTypeBadgeConfig } from "./resource-detail/note-item";
import { DeleteConfirmDialog } from "./resource-detail/delete-confirm-dialog";
import type {
  LibraryResourceItem,
  LibraryResourceNote,
} from "../_types/types";

export { getNoteTypeBadgeConfig };

export interface ResourceDetailProps {
  resource: LibraryResourceItem;
  notes: LibraryResourceNote[];
  onAddNote: (
    note: Omit<LibraryResourceNote, "id" | "createdAt" | "sentToCitationCards">,
  ) => void;
  onDeleteNote: (noteId: number) => void;
  onToggleReadStatus: (resourceId: number) => void;
  onUpdateResource?: (updatedResource: LibraryResourceItem) => void;
  onUploadPdf?: (file: File) => Promise<boolean>;
  onDeletePdf?: (resourceId: number) => Promise<void>;
}

/**
 * Detailed view for a selected library resource with note taking and automatic citation card integration.
 *
 * @param root0 - Component props.
 * @param root0.resource - Selected library resource.
 * @param root0.notes - Notes associated with the resource.
 * @param root0.onAddNote - Callback to add a new note to the resource.
 * @param root0.onDeleteNote - Callback to delete a note by id.
 * @param root0.onToggleReadStatus - Callback to toggle the read status of a resource.
 * @param root0.onUpdateResource - Optional callback invoked after the resource metadata is updated.
 * @param root0.onUploadPdf - Optional callback that uploads a PDF for the resource.
 * @param root0.onDeletePdf - Optional callback that deletes the resource PDF.
 * @returns The resource detail markup.
 */
export function ResourceDetail({
  resource,
  notes,
  onAddNote,
  onDeleteNote,
  onToggleReadStatus,
  onUpdateResource,
  onUploadPdf,
  onDeletePdf,
}: ResourceDetailProps) {
  const [noteToDeleteId, setNoteToDeleteId] = useState<number | null>(null);
  const [pdfToDeleteId, setPdfToDeleteId] = useState<number | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleConfirmDeleteNote = () => {
    if (noteToDeleteId !== null) {
      onDeleteNote(noteToDeleteId);
      setNoteToDeleteId(null);
    }
  };

  const handleConfirmDeletePdf = async () => {
    if (pdfToDeleteId && onDeletePdf) {
      try {
        await onDeletePdf(pdfToDeleteId);
      } catch {}
    }
    setPdfToDeleteId(null);
  };

  return (
    <div className="flex h-full w-full flex-col space-y-6 rounded-md border border-border bg-card p-6">
      <ResourceHeader
        resource={resource}
        onOpenEditModal={() => setIsEditModalOpen(true)}
        onToggleReadStatus={onToggleReadStatus}
        onDeletePdfClick={
          onDeletePdf ? () => setPdfToDeleteId(resource.id) : undefined
        }
      />

      {resource.pdfStatus !== "READY" && onUploadPdf && (
        <PdfUploadDropzone
          resourceTitle={resource.title}
          pdfStatus={resource.pdfStatus}
          onUploadPdf={onUploadPdf}
        />
      )}

      {resource.pdfStatus === "READY" && (
        <>
          <NoteForm resourceId={resource.id} onAddNote={onAddNote} />

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookMarked className="h-5 w-5 text-primary" />
                <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground">
                  Akademik Notlarım ve Alıntılarım
                </h3>
              </div>
              <Badge
                variant="outline"
                className="text-xs font-medium border-border"
              >
                {notes.length} Alıntı Fişi
              </Badge>
            </div>

            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 rounded-md border border-dashed border-border p-6 text-center text-muted-foreground">
                <Sparkles className="h-6 w-6 opacity-40 mb-2" />
                <p className="text-sm font-medium">
                  Henüz bu eser için not veya alıntı girilmemiş.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Yukarıdaki formu kullanarak ilk sayfa numaralı alıntınızı
                  ekleyebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    onDeleteNoteClick={(id) => setNoteToDeleteId(id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <DeleteConfirmDialog
        noteToDeleteId={noteToDeleteId}
        onCloseNoteDeleteDialog={() => setNoteToDeleteId(null)}
        onConfirmDeleteNote={handleConfirmDeleteNote}
        pdfToDeleteId={pdfToDeleteId}
        onClosePdfDeleteDialog={() => setPdfToDeleteId(null)}
        onConfirmDeletePdf={handleConfirmDeletePdf}
      />

      <EditResourceModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        resource={resource}
        onUpdateSuccess={(updatedResource) => {
          onUpdateResource?.(updatedResource);
        }}
      />
    </div>
  );
}
