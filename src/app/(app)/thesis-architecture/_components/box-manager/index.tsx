"use client";

import { useState } from "react";
import type { Box } from "@/core/db/schema";
import type { BoxWithRelations } from "./constants/quadrant-config";
import { useBoxData } from "./hooks/use-box-data";
import { useBoxModals } from "./hooks/use-box-modals";
import { useClipboardExport } from "./hooks/use-clipboard-export";
import { QuadrantMetricsStrip } from "./components/metrics/quadrant-metrics-strip";
import { QuadrantPillarCard } from "./components/pillars/quadrant-pillar-card";
import { AddSubBoxModal } from "./components/modals/add-sub-box-modal";
import { EditSubBoxModal } from "./components/modals/edit-sub-box-modal";
import { EditRootBoxModal } from "./components/modals/edit-root-box-modal";
import { DeleteSubBoxModal } from "./components/modals/delete-sub-box-modal";

export interface BoxManagerViewProps {
  boxesList: BoxWithRelations[] | Box[];
}

/**
 * Orchestrator layout: renders the summary metrics strip, the 4-pillar quadrant grid,
 * and manages modal dialogs for topic boxes.
 */
export function BoxManagerView({ boxesList }: BoxManagerViewProps) {
  const { rootBoxes, subBoxesByParent, totalMetrics } = useBoxData(boxesList);
  const { copySubBox } = useClipboardExport();
  const {
    editSubBox,
    openEditSubModal,
    closeEditSubModal,
    saveEditSubBox,
    isSubSaving,
    isAddOpen,
    addParentId,
    setAddParentId,
    openAddModal,
    closeAddModal,
    saveAddSubBox,
    isAddSaving,
    editRootBox,
    openEditRootModal,
    closeEditRootModal,
    saveEditRootBox,
    isRootSaving,
    deleteTargetBox,
    requestDelete,
    closeDeleteModal,
    confirmDeleteSubBox,
    isDeleting,
  } = useBoxModals({ rootBoxes });

  const [expandedSemanticMap, setExpandedSemanticMap] = useState<
    Record<number, boolean>
  >({});

  const toggleSemantic = (boxId: number) => {
    setExpandedSemanticMap((prev) => ({
      ...prev,
      [boxId]: !prev[boxId],
    }));
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. TOP SUMMARY METRIC STRIP */}
      <QuadrantMetricsStrip
        totalMetrics={totalMetrics}
        onAddNewSubBox={() => openAddModal()}
      />

      {/* 2. MAIN 2X2 QUADRANT PILLARS GRID */}
      <div className="grid gap-5 md:grid-cols-2">
        {rootBoxes.map((rootBox) => (
          <QuadrantPillarCard
            key={rootBox.id}
            rootBox={rootBox}
            subBoxes={subBoxesByParent[rootBox.id] ?? []}
            expandedSemanticMap={expandedSemanticMap}
            onToggleSemantic={toggleSemantic}
            onCopySubBox={copySubBox}
            onEditSubBox={openEditSubModal}
            onDeleteSubBox={requestDelete}
            onAddSubBox={openAddModal}
            onEditRootBox={openEditRootModal}
          />
        ))}
      </div>

      {/* 3. MODALS & DIALOGS */}

      {/* DIALOG 1: EDIT SUB-BOX MODAL */}
      {editSubBox && (
        <EditSubBoxModal
          open={Boolean(editSubBox)}
          box={editSubBox}
          isSaving={isSubSaving}
          onOpenChange={(open) => {
            if (!open) closeEditSubModal();
          }}
          onSave={saveEditSubBox}
        />
      )}

      {/* DIALOG 2: ADD NEW SUB-BOX MODAL */}
      {isAddOpen && (
        <AddSubBoxModal
          open={isAddOpen}
          rootBoxes={rootBoxes}
          parentId={addParentId}
          isSaving={isAddSaving}
          onOpenChange={(open) => {
            if (!open) closeAddModal();
          }}
          onParentIdChange={setAddParentId}
          onSave={saveAddSubBox}
        />
      )}

      {/* DIALOG 3: EDIT ROOT BOX MODAL */}
      {editRootBox && (
        <EditRootBoxModal
          open={Boolean(editRootBox)}
          box={editRootBox}
          isSaving={isRootSaving}
          onOpenChange={(open) => {
            if (!open) closeEditRootModal();
          }}
          onSave={saveEditRootBox}
        />
      )}

      {/* DIALOG 4: DELETE CONFIRMATION MODAL */}
      {deleteTargetBox && (
        <DeleteSubBoxModal
          open={Boolean(deleteTargetBox)}
          box={deleteTargetBox}
          isDeleting={isDeleting}
          onOpenChange={(open) => {
            if (!open) closeDeleteModal();
          }}
          onDelete={confirmDeleteSubBox}
        />
      )}
    </div>
  );
}
