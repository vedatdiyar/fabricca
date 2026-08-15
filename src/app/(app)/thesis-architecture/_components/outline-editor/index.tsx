"use client";

import { Outline, Box, Source, Annotation } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TabActions } from "../tab-actions";
import { useOutlineState } from "./hooks/use-outline-state";
import { useOutlineMetrics } from "./hooks/use-outline-metrics";
import { useOutlineCrud } from "./hooks/use-outline-crud";
import { usePanelHeightSync } from "./hooks/use-panel-height-sync";
import { OutlineMetricsStrip } from "./components/outline-metrics-strip";
import {
  OutlineEmptyState,
  NoSectionSelectedState,
} from "./components/outline-empty-state";
import { OutlineTreeExplorer } from "./components/outline-tree/outline-tree-explorer";
import { SectionDetailCard } from "./components/section-workspace/section-detail-card";
import { SectionSourcesList } from "./components/section-workspace/section-sources-list";
import { AddSectionModal } from "./components/modals/add-section-modal";
import { EditSectionModal } from "./components/modals/edit-section-modal";
import { DeleteSectionModal } from "./components/modals/delete-section-modal";
import { ManageBoxLinksModal } from "./components/modals/manage-box-links-modal";

interface OutlineEditorViewProps {
  outlinesList: Outline[];
  boxesList: Box[];
  sourcesList?: Source[];
  annotationsList?: (Annotation & { source?: Source })[];
  pinnedMap?: Record<number, number[]>;
  linkedBoxMap: Record<number, number[]>;
}

/**
 * Orchestrates the outline editor: wires the state/metrics/crud hooks together
 * and composes the metric strip, tree explorer, section workspace and modals.
 *
 * @param root0 - Component props.
 * @param root0.outlinesList - All outline sections of the thesis.
 * @param root0.boxesList - All thesis topic boxes.
 * @param root0.sourcesList - All library sources of the thesis.
 * @param root0.annotationsList - Citation cards pinned to sections (unused placeholder).
 * @param root0.pinnedMap - Pinned annotation map (unused placeholder).
 * @param root0.linkedBoxMap - Server-side box to outline link map.
 */
export function OutlineEditorView({
  outlinesList,
  boxesList,
  sourcesList = [],
  linkedBoxMap,
}: OutlineEditorViewProps) {
  const state = useOutlineState({
    outlinesList,
    initialLinkedBoxMap: linkedBoxMap,
  });

  const metrics = useOutlineMetrics({
    outlinesList,
    boxesList,
    sourcesList,
    localLinkedBoxMap: state.localLinkedBoxMap,
    selectedOutline: state.selectedOutline,
    treeSearchQuery: state.treeSearchQuery,
    sourceSearchQuery: state.sourceSearchQuery,
    activeFocusedSourceIds: state.activeFocusedSourceIds,
  });

  const { rightPanelRef, rightPanelHeight } = usePanelHeightSync(
    state.selectedOutlineId,
    outlinesList,
  );

  const crud = useOutlineCrud({
    outlinesList,
    rootOutlines: metrics.rootOutlines,
    selectedOutline: state.selectedOutline,
    selectedOutlineId: state.selectedOutlineId,
    setSelectedOutlineId: state.setSelectedOutlineId,
    localLinkedBoxMap: state.localLinkedBoxMap,
    applyBoxLinkOverride: state.applyBoxLinkOverride,
  });

  const isEmpty = outlinesList.length === 0;

  const addParentTitle =
    crud.addParentId != null
      ? outlinesList.find((o) => o.id === crud.addParentId)?.title
      : undefined;

  return (
    <div className="w-full space-y-6">
      {/* Tab Header Action Portal */}
      <TabActions>
        <Button
          size="sm"
          onClick={() => crud.openAddModal(null)}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
        >
          <Plus className="h-4 w-4" />
          <span>Yeni Bölüm Ekle</span>
        </Button>
      </TabActions>

      {/* Top Overview & Metric Strip (3 Columns) */}
      <OutlineMetricsStrip metrics={metrics.metrics} />

      {/* Main Workspace */}
      {isEmpty ? (
        <OutlineEmptyState onAddRoot={() => crud.openAddModal(null)} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Outline Tree Explorer (lg:col-span-4) */}
          <OutlineTreeExplorer
            rootCount={metrics.rootOutlines.length}
            filteredRootOutlines={metrics.filteredRootOutlines}
            getSubOutlines={metrics.getSubOutlines}
            selectedOutlineId={state.selectedOutlineId}
            treeSearchQuery={state.treeSearchQuery}
            localLinkedBoxMap={state.localLinkedBoxMap}
            sourcesList={sourcesList}
            height={rightPanelHeight}
            onTreeSearchChange={state.setTreeSearchQuery}
            onSelect={state.setSelectedOutlineId}
            onAddRoot={() => crud.openAddModal(null)}
            onAddSub={crud.openAddModal}
          />

          {/* Right Column: Active Section Workspace (Natural Height) */}
          <div ref={rightPanelRef} className="lg:col-span-8 space-y-6">
            {state.selectedOutline ? (
              <div className="space-y-6">
                {/* 1. Section Header & Focus Card */}
                <SectionDetailCard
                  outline={state.selectedOutline}
                  sectionBoxes={metrics.sectionBoxes}
                  onAddSub={() => crud.openAddModal(state.selectedOutline!.id)}
                  onEdit={() => crud.openEditModal(state.selectedOutline!)}
                  onDelete={() => crud.promptDelete(state.selectedOutline!)}
                  onManageBoxLinks={crud.openBoxLinkModal}
                />

                {/* 2. Chapter Literature Sources Workspace */}
                <SectionSourcesList
                  outlineId={state.selectedOutline.id}
                  sectionSources={metrics.sectionSources}
                  displayedSources={metrics.displayedSources}
                  sourceSearchQuery={state.sourceSearchQuery}
                  activeFocusedSourceIds={state.activeFocusedSourceIds}
                  onSourceSearchChange={state.setSourceSearchQuery}
                  onToggleFocus={state.toggleSourceFocus}
                  onManageBoxLinks={crud.openBoxLinkModal}
                />
              </div>
            ) : (
              <NoSectionSelectedState />
            )}
          </div>
        </div>
      )}

      {/* Modal: Add New Section */}
      <AddSectionModal
        key={crud.isAddOpen ? "add-open" : "add-closed"}
        open={crud.isAddOpen}
        parentId={crud.addParentId}
        parentTitle={addParentTitle}
        isSaving={crud.isAddSaving}
        onClose={crud.closeAddModal}
        onSubmit={crud.createSection}
      />

      {/* Modal: Edit Section */}
      <EditSectionModal
        key={crud.isEditOpen ? "edit-open" : "edit-closed"}
        open={crud.isEditOpen}
        outline={crud.outlineToEdit}
        isSaving={crud.isEditSaving}
        onClose={crud.closeEditModal}
        onSubmit={crud.updateSection}
      />

      {/* Modal: Delete Confirmation */}
      <DeleteSectionModal
        open={crud.isDeleteOpen}
        outline={crud.outlineToDelete}
        isDeleting={crud.isDeleting}
        onClose={crud.closeDeleteModal}
        onConfirm={crud.confirmDelete}
      />

      {/* Modal: Manage Box Links */}
      <ManageBoxLinksModal
        open={crud.isBoxLinkModalOpen}
        outline={state.selectedOutline}
        boxesList={boxesList}
        localLinkedBoxMap={state.localLinkedBoxMap}
        onToggleLink={crud.toggleBoxLink}
        onClose={crud.closeBoxLinkModal}
      />
    </div>
  );
}
