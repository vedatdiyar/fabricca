"use client";

import { useState } from "react";
import { CitationCardsPageHeader } from "./_components/page-header/citation-page-header";
import { CitationCardsSectionHeading } from "./_components/page-header/citation-section-heading";
import { CitationCardsSkeleton } from "./_components/citation-cards-skeleton";
import { useCitationCardsFilter } from "./_hooks/use-citation-cards-filter";
import { useCitationCardsData } from "./_hooks/use-citation-cards-data";
import { useCardMutations } from "./_hooks/use-card-mutations";
import { CitationOutlineSidebar } from "./_components/citation-outline-sidebar";
import { CitationFilterBar } from "./_components/citation-filter-bar";
import { AiMappingBanner } from "./_components/ai-mapping-banner";
import { CitationCard } from "./_components/citation-card";
import { CitationCardDialog } from "./_components/citation-card-dialog";
import { CitationCardsEmptyState } from "./_components/citation-cards-empty-state";
import { CitationSynthesisView } from "./_components/citation-synthesis-view";
import type { CitationCardItem } from "./_lib/types";

/**
 * Citation Cards & Thesis Workbench (Alıntı Fişleri & Tez Masası) main page component.
 * Features:
 * - Left Panel: Dedicated Thesis Outline Navigation Tree.
 * - Right Panel: Active section cards grid, search, ambient AI auto-mapping, and in-place AI Synthesis Organizer.
 * - Centered Shadcn Dialog for card details and editing.
 */
export default function CitationCardsPage() {
  const [isSynthesisOpen, setIsSynthesisOpen] = useState(false);

  // Modal State (View / Edit / Add)
  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: "view" | "edit";
    cardToEdit: CitationCardItem | null;
  }>({ open: false, mode: "view", cardToEdit: null });

  const { isLoading, data, refreshData, removeCardLocally } =
    useCitationCardsData();

  const { filters, setFilter, clearFilters, filteredCards, counts } =
    useCitationCardsFilter(data.cards);

  /** Handlers for card dialogs & actions */
  const handleOpenAddDialog = () => {
    setDialog({ open: true, mode: "edit", cardToEdit: null });
  };

  const handleOpenViewDialog = (card: CitationCardItem) => {
    setDialog({ open: true, mode: "view", cardToEdit: card });
  };

  const handleOpenEditDialog = (card: CitationCardItem) => {
    setDialog({ open: true, mode: "edit", cardToEdit: card });
  };

  const { handleSaveCard, handleDeleteCard, handleMoveBox } = useCardMutations({
    refreshData,
    removeCardLocally,
  });

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

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Page Header with Single-Click AI Action and Add Button */}
      <CitationCardsPageHeader
        isSynthesisOpen={isSynthesisOpen}
        hasAnyCard={hasAnyCard}
        onToggleSynthesis={() => setIsSynthesisOpen((prev) => !prev)}
        onOpenAddDialog={handleOpenAddDialog}
      />

      {/* Main Page Content */}
      {!hasAnyCard ? (
        <CitationCardsEmptyState
          onClearFilters={clearFilters}
          onAddNew={handleOpenAddDialog}
          hasFilters={false}
        />
      ) : (
        <div className="flex flex-col lg:flex-row items-start gap-6">
          {/* Left Panel: Thesis Outline Sidebar */}
          <CitationOutlineSidebar
            outlines={data.outlines}
            cards={data.cards}
            selectedOutlineId={filters.selectedOutlineId}
            unassignedOnly={filters.unassignedOnly}
            onSelectAll={() => {
              setFilter("selectedOutlineId", null);
              setFilter("unassignedOnly", false);
            }}
            onSelectUnassigned={() => {
              setFilter("selectedOutlineId", null);
              setFilter("unassignedOnly", true);
            }}
            onSelectOutline={(id) => {
              setFilter("selectedOutlineId", id);
              setFilter("unassignedOnly", false);
            }}
          />

          {/* Right Main Area */}
          <div className="flex-1 w-full min-w-0 space-y-4">
            {/* Active Section Breadcrumb / Heading */}
            <CitationCardsSectionHeading
              unassignedOnly={filters.unassignedOnly}
              activeOutline={activeOutline}
              cardCount={filteredCards.length}
            />

            {/* In-Place AI Synthesis Panel (When triggered) */}
            {isSynthesisOpen && (
              <CitationSynthesisView
                cards={filteredCards.length > 0 ? filteredCards : data.cards}
                outlines={data.outlines}
                sources={data.sources}
                selectedOutlineId={filters.selectedOutlineId}
                onRefreshData={refreshData}
                onClose={() => setIsSynthesisOpen(false)}
              />
            )}

            {/* Ambient AI Mapping Banner (Visible when unassigned cards exist) */}
            <AiMappingBanner
              unassignedCount={counts.unassignedCount}
              onRefresh={refreshData}
            />

            {/* Compact Filter Toolbar */}
            <CitationFilterBar
              filters={filters}
              counts={counts}
              boxes={data.boxes}
              sources={data.sources}
              onFilterChange={setFilter}
            />

            {/* Cards Grid / Empty State */}
            <div className="w-full min-h-[400px]">
              {filteredCards.length === 0 ? (
                <CitationCardsEmptyState
                  onClearFilters={clearFilters}
                  onAddNew={handleOpenAddDialog}
                  hasFilters={isFiltering}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {filteredCards.map((card) => (
                    <CitationCard
                      key={card.id}
                      card={card}
                      availableBoxes={data.boxes}
                      onView={handleOpenViewDialog}
                      onEdit={handleOpenEditDialog}
                      onDelete={handleDeleteCard}
                      onMoveBox={handleMoveBox}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Centered Shadcn Dialog Modal (View / Edit / Create Modes) */}
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
