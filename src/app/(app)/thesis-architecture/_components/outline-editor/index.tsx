"use client";

import { Outline, Box, Source, Annotation } from "@/core/db/schema";
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
import { ManageAnnotationLinksModal } from "./components/modals/manage-annotation-links-modal";
import { ManageSourceLinksModal } from "./components/modals/manage-source-links-modal";

interface OutlineEditorViewProps {
  outlinesList: Outline[];
  boxesList: Box[];
  sourcesList?: Source[];
  annotationsList?: (Annotation & { source?: Source })[];
  pinnedMap: Record<number, number[]>;
  linkedSourcesMap: Record<number, number[]>;
}

/**
 * Orchestrates the outline editor: wires the state/metrics/crud hooks together
 * and composes the metric strip, tree explorer, section workspace and modals.
 *
 * @param root0 - Component props.
 * @param root0.outlinesList - All outline sections of the thesis.
 * @param root0.boxesList - All thesis topic boxes.
 * @param root0.sourcesList - All library sources of the thesis.
 * @param root0.annotationsList - Citation cards with their sources.
 * @param root0.pinnedMap - Server-side annotation to outline link map.
 * @param root0.linkedSourcesMap - Server-side source to outline link map.
 */
export function OutlineEditorView({
  outlinesList,
  boxesList,
  sourcesList = [],
  annotationsList = [],
  pinnedMap,
  linkedSourcesMap,
}: OutlineEditorViewProps) {
  const state = useOutlineState({
    outlinesList,
    initialPinnedAnnotationsMap: pinnedMap,
    initialLinkedSourcesMap: linkedSourcesMap,
  });

  const metrics = useOutlineMetrics({
    outlinesList,
    sourcesList,
    annotationsList,
    localPinnedAnnotationsMap: state.localPinnedAnnotationsMap,
    localLinkedSourcesMap: state.localLinkedSourcesMap,
    selectedOutline: state.selectedOutline,
    treeSearchQuery: state.treeSearchQuery,
    sourceSearchQuery: state.sourceSearchQuery,
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
    localPinnedAnnotationsMap: state.localPinnedAnnotationsMap,
    applyAnnotationLinkOverride: state.applyAnnotationLinkOverride,
    localLinkedSourcesMap: state.localLinkedSourcesMap,
    applySourceLinkOverride: state.applySourceLinkOverride,
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

      {/* Top Overview & Metric Strip (4 Columns) */}
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
            sourceCountMap={metrics.sourceCountMap}
            cardCountMap={metrics.cardCountMap}
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
                  cardsCount={metrics.sectionPinnedAnnotationIds.length}
                  sourcesCount={metrics.sectionSourceIds.length}
                  onAddSub={() => crud.openAddModal(state.selectedOutline!.id)}
                  onEdit={() => crud.openEditModal(state.selectedOutline!)}
                  onDelete={() => crud.promptDelete(state.selectedOutline!)}
                />

                {/* 2. Section Reading Workspace: Pinned Citation Cards + Linked Sources */}
                <SectionSourcesList
                  sectionAnnotations={metrics.sectionAnnotations}
                  sectionSources={metrics.sectionSources}
                  displayedSources={metrics.displayedSources}
                  sourceSearchQuery={state.sourceSearchQuery}
                  onSourceSearchChange={state.setSourceSearchQuery}
                  onManageAnnotationLinks={crud.openAnnotationLinkModal}
                  onManageSourceLinks={crud.openSourceLinkModal}
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

      {/* Modal: Manage Annotation (Citation Card) Links */}
      <ManageAnnotationLinksModal
        open={crud.isAnnotationLinkModalOpen}
        outline={state.selectedOutline}
        annotationsList={annotationsList}
        boxesList={boxesList}
        localPinnedAnnotationsMap={state.localPinnedAnnotationsMap}
        onToggleAnnotationLink={crud.toggleAnnotationLink}
        onClose={crud.closeAnnotationLinkModal}
      />

      {/* Modal: Manage Source Links */}
      <ManageSourceLinksModal
        open={crud.isSourceLinkModalOpen}
        outline={state.selectedOutline}
        sourcesList={sourcesList}
        boxesList={boxesList}
        localLinkedSourcesMap={state.localLinkedSourcesMap}
        onToggleSourceLink={crud.toggleSourceLink}
        onClose={crud.closeSourceLinkModal}
      />
    </div>
  );
}
