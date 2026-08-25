"use client";

import { useState } from "react";
import { CitationCardsSectionHeading } from "./_components/page-header/citation-section-heading";
import { CitationCardsSkeleton } from "./_components/citation-cards-skeleton";
import { useCitationCardsFilter } from "./_hooks/use-citation-cards-filter";
import { useCitationCardsData } from "./_hooks/use-citation-cards-data";
import { useCardMutations } from "./_hooks/use-card-mutations";
import { CitationOutlineSidebar } from "./_components/citation-outline-sidebar";
import { CitationFilterBar } from "./_components/citation-filter-bar";
import { AiMappingBanner } from "./_components/ai-mapping-banner";
import { CitationCard } from "./_components/citation-card";
import { CitationListView } from "./_components/citation-list-view";
import { CitationInspector } from "./_components/citation-inspector";
import { CitationCardDialog } from "./_components/citation-card-dialog";
import { CitationCardsEmptyState } from "./_components/citation-cards-empty-state";
import type { CitationCardItem } from "./_lib/types";

/**
 * Citation Cards & Thesis Workbench (Alıntı Fişleri & Tez Masası) main page.
 * Redesigned for academic elegance, visual clarity, and high productivity.
 */
export default function CitationCardsPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [inspectorCardId, setInspectorCardId] = useState<number | null>(null);

  // Modal State for Add / Edit
  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: "view" | "edit";
    cardToEdit: CitationCardItem | null;
  }>({ open: false, mode: "edit", cardToEdit: null });

  const { isLoading, data, refreshData, removeCardLocally } =
    useCitationCardsData();

  const { filters, setFilter, clearFilters, filteredCards, counts } =
    useCitationCardsFilter(data.cards);

  const {
    handleSaveCard,
    handleDeleteCard,
    handleMoveBox,
    handleAssignOutline,
  } = useCardMutations({
    refreshData,
    removeCardLocally,
  });

  /** Handlers for card dialogs & actions */
  const handleOpenAddDialog = () => {
    setDialog({ open: true, mode: "edit", cardToEdit: null });
  };

  const handleOpenEditDialog = (card: CitationCardItem) => {
    setDialog({ open: true, mode: "edit", cardToEdit: card });
  };

  const handleViewCard = (card: CitationCardItem) => {
    setInspectorCardId(card.id);
  };

  const handleCloseInspector = () => {
    setInspectorCardId(null);
  };

  if (isLoading) {
    return <CitationCardsSkeleton />;
  }

  const hasAnyCard = data.cards.length > 0;
  const isFiltering =
    filters.selectedBoxId !== null ||
    filters.selectedSourceId !== null ||
    filters.selectedOutlineId !== null ||
    filters.unassignedOnly ||
    filters.activeNoteTypeTab !== "ALL" ||
    filters.searchQuery.trim() !== "";

  // Active section metadata
  const activeOutline = data.outlines.find(
    (o) => o.id === filters.selectedOutlineId,
  );
  const activeBox = data.boxes.find((b) => b.id === filters.selectedBoxId);

  // Inspector card reference and navigation
  const inspectorCardIndex = filteredCards.findIndex(
    (c) => c.id === inspectorCardId,
  );
  const inspectorCard =
    inspectorCardIndex !== -1 ? filteredCards[inspectorCardIndex] : null;
  const hasPrev = inspectorCardIndex > 0;
  const hasNext =
    inspectorCardIndex !== -1 && inspectorCardIndex < filteredCards.length - 1;

  const handlePrevCard = () => {
    if (hasPrev) {
      setInspectorCardId(filteredCards[inspectorCardIndex - 1].id);
    }
  };

  const handleNextCard = () => {
    if (hasNext) {
      setInspectorCardId(filteredCards[inspectorCardIndex + 1].id);
    }
  };

  return (
    <div className="w-full space-y-5 pb-12">
      {/* Main Page Content */}
      {!hasAnyCard ? (
        <CitationCardsEmptyState
          onClearFilters={clearFilters}
          onAddNew={handleOpenAddDialog}
          hasFilters={false}
        />
      ) : (
        <div className="flex flex-col lg:flex-row items-start gap-5 relative">
          {/* Left Panel: Thesis Outline & Topic Navigator (Sticky with breathing gap from header) */}
          <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-24 self-start">
            <CitationOutlineSidebar
              outlines={data.outlines}
              cards={data.cards}
              boxes={data.boxes}
              selectedOutlineId={filters.selectedOutlineId}
              selectedBoxId={filters.selectedBoxId}
              unassignedOnly={filters.unassignedOnly}
              onSelectAll={() => {
                setFilter("selectedOutlineId", null);
                setFilter("selectedBoxId", null);
                setFilter("unassignedOnly", false);
              }}
              onSelectUnassigned={() => {
                setFilter("selectedOutlineId", null);
                setFilter("selectedBoxId", null);
                setFilter("unassignedOnly", true);
              }}
              onSelectOutline={(id) => {
                setFilter("selectedOutlineId", id);
                setFilter("unassignedOnly", false);
              }}
              onSelectBox={(boxId) => {
                setFilter("selectedBoxId", boxId);
              }}
            />
          </div>

          {/* Right Main Area: Workspace Canvas */}
          <div className="flex-1 w-full min-w-0 space-y-4">
            {/* Active Context Heading */}
            <CitationCardsSectionHeading
              unassignedOnly={filters.unassignedOnly}
              activeOutline={activeOutline}
              activeBoxTitle={activeBox?.title}
              cardCount={filteredCards.length}
              hasFilters={isFiltering}
              onClearFilters={clearFilters}
            />

            {/* Ambient AI Auto-Map Notice (Visible when unassigned cards exist) */}
            <AiMappingBanner
              unassignedCount={counts.unassignedCount}
              onRefresh={refreshData}
            />

            {/* Unified Filter & Action Toolbar */}
            <CitationFilterBar
              filters={filters}
              counts={counts}
              sources={data.sources}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onFilterChange={setFilter}
              onOpenAddDialog={handleOpenAddDialog}
            />

            {/* Cards Content (Grid or List View) */}
            <div className="w-full min-h-[400px]">
              {filteredCards.length === 0 ? (
                <CitationCardsEmptyState
                  onClearFilters={clearFilters}
                  onAddNew={handleOpenAddDialog}
                  hasFilters={isFiltering}
                />
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {filteredCards.map((card) => (
                    <CitationCard
                      key={card.id}
                      card={card}
                      availableBoxes={data.boxes}
                      isSelected={card.id === inspectorCardId}
                      onView={handleViewCard}
                      onEdit={handleOpenEditDialog}
                      onDelete={handleDeleteCard}
                      onMoveBox={handleMoveBox}
                    />
                  ))}
                </div>
              ) : (
                <CitationListView
                  cards={filteredCards}
                  availableBoxes={data.boxes}
                  selectedCardId={inspectorCardId}
                  onView={handleViewCard}
                  onEdit={handleOpenEditDialog}
                  onDelete={handleDeleteCard}
                  onMoveBox={handleMoveBox}
                />
              )}
            </div>
          </div>

          {/* Slide-over Inspector Drawer (When card is inspected) */}
          {inspectorCard && (
            <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pl-10 shadow-2xl">
              {/* Backdrop */}
              <div
                role="presentation"
                className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity duration-200"
                onClick={handleCloseInspector}
              />

              <div className="relative w-screen max-w-md bg-card border-l border-border z-10 shadow-xl">
                <CitationInspector
                  card={inspectorCard}
                  outlines={data.outlines}
                  onClose={handleCloseInspector}
                  onEdit={(card) => {
                    handleCloseInspector();
                    handleOpenEditDialog(card);
                  }}
                  onDelete={(id) => {
                    handleCloseInspector();
                    handleDeleteCard(id);
                  }}
                  onAssignOutline={handleAssignOutline}
                  onPrevCard={handlePrevCard}
                  onNextCard={handleNextCard}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Centered Modal Dialog for Creating & Editing Cards */}
      <CitationCardDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        cardToEdit={dialog.cardToEdit}
        mode={dialog.mode}
        sources={data.sources}
        boxes={data.boxes}
        outlines={data.outlines}
        onSave={handleSaveCard}
      />
    </div>
  );
}
