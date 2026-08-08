"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useCitationCardsFilter } from "./_hooks/use-citation-cards-filter";
import { CitationCard } from "./_components/citation-card";
import { CitationCardDialog } from "./_components/citation-card-dialog";
import { CitationSidebar } from "./_components/citation-sidebar";
import { CitationMetricsOverview } from "./_components/CitationMetricsOverview";
import { CitationCardsToolbar } from "./_components/CitationCardsToolbar";
import { CitationCardsEmptyState } from "./_components/CitationCardsEmptyState";
import {
  getCitationCardsDataAction,
  createCitationCardAction,
  updateCitationCardAction,
  deleteCitationCardAction,
  moveCitationCardBoxAction,
} from "./actions";
import type { BoxItem, CitationCardItem, SourceItem } from "./_lib/types";

/**
 * Citation Cards (Alıntı Fişleri) main page component.
 *
 * @returns The complete citation cards interactive page markup.
 */
export default function CitationCardsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<{
    cards: CitationCardItem[];
    boxes: BoxItem[];
    sources: SourceItem[];
  }>({ cards: [], boxes: [], sources: [] });

  const { filters, setFilter, clearFilters, filteredCards, counts } =
    useCitationCardsFilter(data.cards);

  // Modal State
  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: "view" | "edit";
    cardToEdit: CitationCardItem | null;
  }>({ open: false, mode: "view", cardToEdit: null });

  /**
   * Refreshes citation cards data from database.
   */
  const refreshData = useCallback(async () => {
    const res = await getCitationCardsDataAction();
    if (res.success) {
      setData({
        cards: res.data.cards,
        boxes: res.data.boxes,
        sources: res.data.sources,
      });
    } else {
      toast.error(res.error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getCitationCardsDataAction().then((res) => {
      if (!isMounted) return;
      if (res.success) {
        setData({
          cards: res.data.cards,
          boxes: res.data.boxes,
          sources: res.data.sources,
        });
      } else {
        toast.error(res.error);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Handlers for card CRUD operations via Server Actions.
   */
  const handleOpenAddDialog = () => {
    setDialog({ open: true, mode: "edit", cardToEdit: null });
  };

  const handleOpenViewDialog = (card: CitationCardItem) => {
    setDialog({ open: true, mode: "view", cardToEdit: card });
  };

  const handleOpenEditDialog = (card: CitationCardItem) => {
    setDialog({ open: true, mode: "edit", cardToEdit: card });
  };

  const handleSaveCard = async (
    cardData: Omit<CitationCardItem, "id" | "createdAt" | "updatedAt"> & {
      id?: number;
    },
  ) => {
    if (cardData.id) {
      // Update existing card
      const res = await updateCitationCardAction({
        id: cardData.id,
        sourceId: cardData.sourceId,
        boxId: cardData.boxId,
        noteType: cardData.noteType,
        pageNumber: cardData.pageNumber,
        content: cardData.content,
        comment: cardData.comment,
      });

      if (res.success) {
        toast.success("Alıntı fişi başarıyla güncellendi.");
        await refreshData();
      } else {
        toast.error(res.error);
      }
    } else {
      // Add new card
      const res = await createCitationCardAction({
        sourceId: cardData.sourceId,
        boxId: cardData.boxId,
        noteType: cardData.noteType,
        pageNumber: cardData.pageNumber,
        content: cardData.content,
        comment: cardData.comment,
      });

      if (res.success) {
        toast.success("Yeni alıntı fişi başarıyla eklendi.");
        await refreshData();
      } else {
        toast.error(res.error);
      }
    }
  };

  const handleDeleteCard = async (id: number) => {
    const res = await deleteCitationCardAction(id);
    if (res.success) {
      setData((prev) => ({
        ...prev,
        cards: prev.cards.filter((c) => c.id !== id),
      }));
      toast.success("Alıntı fişi silindi.");
    } else {
      toast.error(res.error);
    }
  };

  const handleMoveBox = async (cardId: number, targetBoxId: number) => {
    const res = await moveCitationCardBoxAction({ cardId, targetBoxId });
    if (res.success) {
      toast.success("Fiş yeni konu kutusuna taşındı.");
      await refreshData();
    } else {
      toast.error(res.error);
    }
  };

  if (isLoading) {
    return <LoadingSpinner variant="full" />;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Overview Metric Cards */}
      <CitationMetricsOverview counts={counts} />

      {/* Main Layout: Left Sidebar + Right Card List */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Sidebar */}
        <CitationSidebar
          boxes={data.boxes}
          sources={data.sources}
          cards={data.cards}
          selectedBoxId={filters.selectedBoxId}
          selectedSourceId={filters.selectedSourceId}
          onSelectBox={(id) => setFilter("selectedBoxId", id)}
          onSelectSource={(id) => setFilter("selectedSourceId", id)}
        />

        {/* Right Main Area */}
        <div className="flex-1 flex flex-col gap-4 w-full min-w-0">
          {/* Main Controls: Search, Tabs, Sort & View Mode */}
          <CitationCardsToolbar
            filters={filters}
            onFilterChange={setFilter}
            resultCount={filteredCards.length}
            onAddNew={handleOpenAddDialog}
          />

          {/* Cards Display Grid */}
          {filteredCards.length === 0 ? (
            <CitationCardsEmptyState
              onClearFilters={clearFilters}
              onAddNew={handleOpenAddDialog}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Add / Edit Dialog Modal */}
      <CitationCardDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        cardToEdit={dialog.cardToEdit}
        mode={dialog.mode}
        sources={data.sources}
        boxes={data.boxes}
        onSave={handleSaveCard}
      />
    </div>
  );
}
