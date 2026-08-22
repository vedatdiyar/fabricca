"use client";

import React, { useState } from "react";
import { BookMarked, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PdfUploadDropzone } from "./pdf-upload-dropzone";
import { EditResourceModal } from "./edit-resource-modal";
import { ResourceHeader } from "./resource-detail/resource-header";
import { CritiqueSection } from "./resource-detail/critique-section";
import { NoteForm } from "./resource-detail/note-form";
import { NoteItem, getNoteTypeBadgeConfig } from "./resource-detail/note-item";
import { DeleteConfirmDialog } from "./resource-detail/delete-confirm-dialog";
import type {
  LibraryResourceItem,
  LibraryResourceNote,
  LibraryResourceCritique,
  ResourceAuditReport,
  NoteType,
} from "../_lib/types";
import type { CritiqueFormInput } from "../_hooks/use-resource-critique";

export { getNoteTypeBadgeConfig };

export interface ResourceDetailProps {
  resource: LibraryResourceItem;
  notes: LibraryResourceNote[];
  critique?: LibraryResourceCritique;
  onAddNote: (
    note: Omit<
      LibraryResourceNote,
      "id" | "createdAt" | "sentToCitationCards" | "verificationStatus"
    >,
  ) => void;
  onUpdateNote?: (input: {
    noteId: number;
    pageNumber?: string;
    noteType?: NoteType;
  }) => void;
  onSaveCritique: (
    input: CritiqueFormInput,
    silent?: boolean,
  ) => void | Promise<void>;
  onEvaluateCritique?: (
    resourceId?: number,
  ) => Promise<ResourceAuditReport | null>;
  isEvaluating?: boolean;
  onDeleteNote: (noteId: number) => void;
  onToggleReadStatus: (resourceId: number) => void;
  onUpdateResource?: (updatedResource: LibraryResourceItem) => void;
  onUploadPdf?: (file: File) => Promise<boolean>;
  onDeletePdf?: (resourceId: number) => Promise<void>;
}

/**
 * Detailed view for a selected library resource with segmented workspaces
 * for quotation note taking and 5-dimensional critique analysis.
 *
 * @param root0 - Component props.
 * @param root0.resource - Selected library resource.
 * @param root0.notes - Notes associated with the resource.
 * @param root0.critique - Saved critique / analysis.
 * @param root0.onAddNote - Callback to add a new note to the resource.
 * @param root0.onUpdateNote - Callback to update a note.
 * @param root0.onSaveCritique - Callback to auto-save critique fields.
 * @param root0.onEvaluateCritique - Callback to trigger holistic LLM evaluation.
 * @param root0.isEvaluating - Loading state for LLM evaluation.
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
  critique,
  onAddNote,
  onUpdateNote,
  onSaveCritique,
  onEvaluateCritique,
  isEvaluating = false,
  onDeleteNote,
  onToggleReadStatus,
  onUpdateResource,
  onUploadPdf,
  onDeletePdf,
}: ResourceDetailProps) {
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    "critique" | "notes"
  >("critique");
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

  const completedCritiqueCount = critique
    ? [
        critique.researchQuestion,
        critique.theoreticalFramework,
        critique.methodology,
        critique.mainArgument,
        critique.literatureGap,
      ].filter((val) => Boolean(val && val.trim().length > 0)).length
    : 0;

  return (
    <Card className="flex h-full w-full flex-col space-y-5 rounded-md p-5 sm:p-6">
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
        <div className="space-y-5">
          {/* Segmented Workspace Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              {/* Tab 1: 5 Boyutlu Eser Analizi (Öncelikli) */}
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab("critique")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-all ${
                  activeWorkspaceTab === "critique"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-border/40"
                }`}
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>5 Boyutlu Eser Analizi</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold px-1.5 py-0 border ${
                    activeWorkspaceTab === "critique"
                      ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
                      : "bg-background text-muted-foreground border-border/60"
                  }`}
                >
                  {completedCritiqueCount}/5
                </Badge>

                {critique?.aiEvaluation && (
                  <span
                    className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      activeWorkspaceTab === "critique"
                        ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
                        : "bg-success/10 text-success border-success/30"
                    }`}
                  >
                    Skor: {critique.aiEvaluation.overallScore}/100
                  </span>
                )}
              </button>

              {/* Tab 2: Alıntı Fişleri & Notlar */}
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab("notes")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-all ${
                  activeWorkspaceTab === "notes"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-border/40"
                }`}
              >
                <BookMarked className="h-4 w-4 shrink-0" />
                <span>Alıntı Fişleri & Notlar</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold px-1.5 py-0 border ${
                    activeWorkspaceTab === "notes"
                      ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
                      : "bg-background text-muted-foreground border-border/60"
                  }`}
                >
                  {notes.length} Fiş
                </Badge>
              </button>
            </div>
          </div>

          {/* WORKSPACE 1: 5-DIMENSIONAL CRITIQUE & AI AUDIT (Varsayılan) */}
          {activeWorkspaceTab === "critique" && (
            <CritiqueSection
              resourceId={resource.id}
              critique={critique}
              onSaveCritique={onSaveCritique}
              onEvaluateCritique={onEvaluateCritique}
              isEvaluating={isEvaluating}
            />
          )}

          {/* WORKSPACE 2: QUOTATIONS & NOTES */}
          {activeWorkspaceTab === "notes" && (
            <div className="space-y-6">
              <NoteForm resourceId={resource.id} onAddNote={onAddNote} />

              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <div className="flex items-center gap-2">
                    <BookMarked className="h-4 w-4 text-primary" />
                    <h3 className="font-serif text-base font-medium tracking-tight text-foreground">
                      Kayıtlı Alıntı Fişleri
                    </h3>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs font-medium border-border"
                  >
                    {notes.length} Fiş
                  </Badge>
                </div>

                {notes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-36 rounded-md border border-dashed border-border p-6 text-center text-muted-foreground">
                    <Sparkles className="h-6 w-6 opacity-40 mb-2" />
                    <p className="text-sm font-medium">
                      Henüz bu eser için not veya alıntı fişi girilmemiş.
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
                        onUpdateNote={onUpdateNote}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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
    </Card>
  );
}
