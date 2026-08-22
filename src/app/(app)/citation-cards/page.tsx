"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, FolderTree, AlertCircle, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CitationCardsSkeleton } from "./_components/citation-cards-skeleton";
import { useCitationCardsFilter } from "./_hooks/use-citation-cards-filter";
import { CitationOutlineSidebar } from "./_components/citation-outline-sidebar";
import { CitationFilterBar } from "./_components/citation-filter-bar";
import { AiMappingBanner } from "./_components/ai-mapping-banner";
import { CitationCard } from "./_components/citation-card";
import { CitationCardDialog } from "./_components/citation-card-dialog";
import { CitationCardsEmptyState } from "./_components/citation-cards-empty-state";
import { CitationSynthesisView } from "./_components/citation-synthesis-view";
import {
  getCitationCardsDataAction,
  createCitationCardAction,
  updateCitationCardAction,
  deleteCitationCardAction,
  moveCitationCardBoxAction,
  updateCardOutlineLinkAction,
} from "./actions";
import type {
  BoxItem,
  CitationCardItem,
  OutlineItem,
  SourceItem,
} from "./_lib/types";

interface CitationCardsPageHeaderProps {
  isSynthesisOpen: boolean;
  hasAnyCard: boolean;
  onToggleSynthesis: () => void;
  onOpenAddDialog: () => void;
}

function CitationCardsPageHeader({
  isSynthesisOpen,
  hasAnyCard,
  onToggleSynthesis,
  onOpenAddDialog,
}: CitationCardsPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
          Alıntı Fişleri & Tez Masası
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tez konu kutularındaki okumaları tez iskeletinin (Outline) alt
          başlıklarına bağlayan araştırma masası.
        </p>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
        {/* 1-Click AI Synthesis Action */}
        <Button
          variant={isSynthesisOpen ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleSynthesis}
          disabled={!hasAnyCard}
          className={`gap-1.5 h-9 px-3.5 border-primary/30 text-xs font-medium cursor-pointer transition-colors ${
            isSynthesisOpen
              ? "bg-primary/15 text-primary border-primary/40"
              : "bg-primary/5 hover:bg-primary/10 text-primary"
          }`}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span>
            {isSynthesisOpen ? "Sentezi Gizle" : "Fikir & Argüman Sentezi"}
          </span>
        </Button>

        {/* Global Add Card Button */}
        <Button
          onClick={onOpenAddDialog}
          size="sm"
          className="gap-1.5 h-9 px-3.5 shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Yeni Fiş</span>
        </Button>
      </div>
    </div>
  );
}

interface CitationCardsSectionHeadingProps {
  unassignedOnly: boolean;
  activeOutline?: OutlineItem;
  cardCount: number;
}

function CitationCardsSectionHeading({
  unassignedOnly,
  activeOutline,
  cardCount,
}: CitationCardsSectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/40">
      <div className="flex items-center gap-2 min-w-0">
        {unassignedOnly ? (
          <>
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <h2 className="font-serif text-sm font-semibold text-amber-600 dark:text-amber-400 truncate">
              Henüz Bir Tez Bölümüne Atanmamış Fişler Havuzu
            </h2>
          </>
        ) : activeOutline ? (
          <>
            <FolderTree className="h-4 w-4 text-primary shrink-0" />
            <h2 className="font-serif text-sm font-semibold text-foreground truncate">
              {activeOutline.title}
            </h2>
            {activeOutline.description && (
              <span className="text-xs text-muted-foreground truncate hidden md:inline">
                — {activeOutline.description}
              </span>
            )}
          </>
        ) : (
          <>
            <Layers className="h-4 w-4 text-primary shrink-0" />
            <h2 className="font-serif text-sm font-semibold text-foreground truncate">
              Tüm Alıntı Fişleri
            </h2>
          </>
        )}
      </div>

      <span className="font-mono text-xs text-muted-foreground shrink-0">
        {cardCount} Fiş
      </span>
    </div>
  );
}

/**
 * Citation Cards & Thesis Workbench (Alıntı Fişleri & Tez Masası) main page component.
 * Features:
 * - Left Panel: Dedicated Thesis Outline Navigation Tree.
 * - Right Panel: Active section cards grid, search, ambient AI auto-mapping, and in-place AI Synthesis Organizer.
 * - Centered Shadcn Dialog for card details and editing.
 */
export default function CitationCardsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSynthesisOpen, setIsSynthesisOpen] = useState(false);
  const [data, setData] = useState<{
    cards: CitationCardItem[];
    boxes: BoxItem[];
    sources: SourceItem[];
    outlines: OutlineItem[];
  }>({ cards: [], boxes: [], sources: [], outlines: [] });

  const { filters, setFilter, clearFilters, filteredCards, counts } =
    useCitationCardsFilter(data.cards);

  // Modal State (View / Edit / Add)
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
        outlines: res.data.outlines,
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
          outlines: res.data.outlines,
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

  const handleSaveCard = async (
    cardData: Omit<CitationCardItem, "id" | "createdAt" | "updatedAt"> & {
      id?: number;
    },
  ) => {
    const targetOutlineId =
      cardData.outlineIds && cardData.outlineIds.length > 0
        ? cardData.outlineIds[0]
        : null;

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
        await updateCardOutlineLinkAction({
          annotationId: cardData.id,
          outlineId: targetOutlineId,
        });
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
        if (targetOutlineId !== null) {
          await updateCardOutlineLinkAction({
            annotationId: res.data.id,
            outlineId: targetOutlineId,
          });
        }
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
