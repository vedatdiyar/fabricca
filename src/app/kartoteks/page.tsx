"use client";

import React from "react";
import { Loader2, AlertCircle } from "lucide-react";

import { useKartoteks } from "./_hooks/use-kartoteks";
import { KartoteksHeader } from "./_components/kartoteks-header";
import { UnclassifiedPool } from "./_components/unclassified-pool";
import { ThematicBoxesGrid } from "./_components/thematic-boxes-grid";
import { KartoteksPreviewDialog } from "./_components/kartoteks-preview-dialog";
import { FikirSepetiDialog } from "./_components/fikir-sepeti-dialog";

import { Alert, AlertDescription } from "@/components/ui/alert";

export default function KartoteksPage() {
  const {
    pageState,
    previewNote,
    setPreviewNote,
    insightsState,
    setInsightsState,
    isInsightsOpen,
    setIsInsightsOpen,
    handleCreateInsight,
    handleDeleteInsight,
    handleSharpenInsight,
    handleTransferNote,
    handleDragEnterLeftPool,
    handleDragLeaveLeftPool,
    handleDropLeftPool,
    handleDragStartNote,
    handleDragEndNote,
    handleDragEnterBox,
    handleDragLeaveBox,
    handleDropBox,
  } = useKartoteks();

  if (pageState.isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] bg-background text-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-sm font-semibold tracking-wide text-muted-foreground animate-pulse">
          Bilgi Fişi Laboratuvarı yükleniyor...
        </p>
      </div>
    );
  }

  const unclassifiedNotes = pageState.notes.filter(
    (note) => note.boxId === null,
  );

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground p-6 md:p-10 font-sans">
      <KartoteksHeader />

      {pageState.error && (
        <Alert
          variant="destructive"
          className="border-destructive bg-destructive text-destructive-foreground mb-6 items-center"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive-foreground" />
          <AlertDescription className="text-xs font-semibold leading-normal">
            {pageState.error}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <UnclassifiedPool
          unclassifiedNotes={unclassifiedNotes}
          boxes={pageState.boxes}
          transferringNoteId={pageState.transferringNoteId}
          draggedNoteId={pageState.draggedNoteId}
          isLeftPoolOver={pageState.isLeftPoolOver}
          onDragEnter={handleDragEnterLeftPool}
          onDragLeave={handleDragLeaveLeftPool}
          onDrop={handleDropLeftPool}
          onDragStart={handleDragStartNote}
          onDragEnd={handleDragEndNote}
          onTransferNote={handleTransferNote}
          onEditNote={setPreviewNote}
        />

        <ThematicBoxesGrid
          boxes={pageState.boxes}
          notes={pageState.notes}
          overBoxId={pageState.overBoxId}
          draggedNoteId={pageState.draggedNoteId}
          transferringNoteId={pageState.transferringNoteId}
          onDragEnterBox={handleDragEnterBox}
          onDragLeaveBox={handleDragLeaveBox}
          onDropBox={handleDropBox}
          onDragStartNote={handleDragStartNote}
          onDragEndNote={handleDragEndNote}
          onTransferNote={handleTransferNote}
          onEditNote={setPreviewNote}
        />
      </div>

      <KartoteksPreviewDialog
        note={previewNote}
        boxes={pageState.boxes}
        isOpen={previewNote !== null}
        onClose={() => setPreviewNote(null)}
      />

      <FikirSepetiDialog
        isInsightsOpen={isInsightsOpen}
        setIsInsightsOpen={setIsInsightsOpen}
        insightsState={insightsState}
        setInsightsState={setInsightsState}
        handleCreateInsight={handleCreateInsight}
        handleDeleteInsight={handleDeleteInsight}
        handleSharpenInsight={handleSharpenInsight}
      />
    </div>
  );
}
