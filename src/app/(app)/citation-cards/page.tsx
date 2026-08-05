"use client";

import {
  BookOpen,
  Plus,
  Search,
  Grid,
  List as ListIcon,
  Sparkles,
  Quote,
  Bookmark,
  FileSpreadsheet,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CitationCard } from "./_components/citation-card";
import { CitationCardDialog } from "./_components/citation-card-dialog";
import { CitationSidebar } from "./_components/citation-sidebar";
import {
  getCitationCardsDataAction,
  createCitationCardAction,
  updateCitationCardAction,
  deleteCitationCardAction,
  moveCitationCardBoxAction,
} from "./actions";
import type { BoxItem, CitationCardItem, SourceItem } from "./_lib/types";

/** Turkish display labels dictionary for sorting options. */
const SORT_DISPLAY_LABELS: Record<string, string> = {
  NEWEST: "En Yeni",
  OLDEST: "En Eski",
  SOURCE_TITLE: "Kaynağa Göre",
  PAGE_NUMBER: "Sayfa Numarasına Göre",
};

/**
 * Citation Cards (Alıntı Fişleri) main page component.
 *
 * @returns The complete citation cards interactive page markup.
 */
export default function CitationCardsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [cards, setCards] = useState<CitationCardItem[]>([]);
  const [boxes, setBoxes] = useState<BoxItem[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);

  // Filtering & Sorting State
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [activeNoteTypeTab, setActiveNoteTypeTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("NEWEST");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<CitationCardItem | null>(null);

  /**
   * Refreshes citation cards data from database.
   */
  const refreshData = useCallback(async () => {
    const res = await getCitationCardsDataAction();
    if (res.success) {
      setCards(res.data.cards);
      setBoxes(res.data.boxes);
      setSources(res.data.sources);
    } else {
      toast.error(res.error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getCitationCardsDataAction().then((res) => {
      if (!isMounted) return;
      if (res.success) {
        setCards(res.data.cards);
        setBoxes(res.data.boxes);
        setSources(res.data.sources);
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
   * Filter and sort cards based on current state parameters.
   */
  const filteredCards = useMemo(() => {
    return cards
      .filter((card) => {
        // Filter by topic box
        if (selectedBoxId !== null && card.boxId !== selectedBoxId) {
          return false;
        }

        // Filter by source
        if (selectedSourceId !== null && card.sourceId !== selectedSourceId) {
          return false;
        }

        // Filter by note type tab
        if (
          activeNoteTypeTab !== "ALL" &&
          card.noteType !== activeNoteTypeTab
        ) {
          return false;
        }

        // Filter by search query
        if (searchQuery.trim() !== "") {
          const query = searchQuery.toLowerCase();
          const matchContent = card.content.toLowerCase().includes(query);
          const matchTitle = card.sourceTitle.toLowerCase().includes(query);
          const matchAuthors = card.sourceAuthors.some((a) =>
            a.toLowerCase().includes(query),
          );
          const matchPage = card.pageNumber.toLowerCase().includes(query);

          if (!matchContent && !matchTitle && !matchAuthors && !matchPage) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "NEWEST") {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
        if (sortBy === "OLDEST") {
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }
        if (sortBy === "SOURCE_TITLE") {
          return a.sourceTitle.localeCompare(b.sourceTitle, "tr");
        }
        if (sortBy === "PAGE_NUMBER") {
          return a.pageNumber.localeCompare(b.pageNumber, "tr", {
            numeric: true,
          });
        }
        return 0;
      });
  }, [
    cards,
    selectedBoxId,
    selectedSourceId,
    activeNoteTypeTab,
    searchQuery,
    sortBy,
  ]);

  /**
   * Handlers for card CRUD operations via Server Actions.
   */
  const handleOpenAddDialog = () => {
    setCardToEdit(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (card: CitationCardItem) => {
    setCardToEdit(card);
    setIsDialogOpen(true);
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
      setCards((prev) => prev.filter((c) => c.id !== id));
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

  // Metric counts
  const totalCount = cards.length;
  const quoteCount = cards.filter((c) => c.noteType === "DIRECT_QUOTE").length;
  const paraphraseCount = cards.filter(
    (c) => c.noteType === "PARAPHRASE",
  ).length;
  const noteCount = cards.filter((c) => c.noteType === "PERSONAL_NOTE").length;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Header & Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
              Alıntı Fişleri
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Akademik tez kaynaklarınızdan çıkardığınız doğrudan alıntıları,
            açımlamaları ve kişisel fişlerinizi organize edin.
          </p>
        </div>

        <Button onClick={handleOpenAddDialog} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          <span>Yeni Alıntı Fişi</span>
        </Button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-md border border-border bg-card backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Toplam Fiş</span>
            <FileSpreadsheet className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totalCount}</div>
        </div>

        <div className="p-3.5 rounded-md border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 mb-1">
            <span className="text-xs font-medium">Doğrudan Alıntı</span>
            <Quote className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
            {quoteCount}
          </div>
        </div>

        <div className="p-3.5 rounded-md border border-blue-500/20 bg-blue-500/5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 mb-1">
            <span className="text-xs font-medium">Dolaylı Alıntı</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {paraphraseCount}
          </div>
        </div>

        <div className="p-3.5 rounded-md border border-purple-500/20 bg-purple-500/5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 mb-1">
            <span className="text-xs font-medium">Kişisel Not</span>
            <Bookmark className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {noteCount}
          </div>
        </div>
      </div>

      {/* Main Layout: Left Sidebar + Right Card List */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Sidebar */}
        <CitationSidebar
          boxes={boxes}
          sources={sources}
          cards={cards}
          selectedBoxId={selectedBoxId}
          selectedSourceId={selectedSourceId}
          onSelectBox={setSelectedBoxId}
          onSelectSource={setSelectedSourceId}
        />

        {/* Right Main Area */}
        <div className="flex-1 flex flex-col gap-4 w-full min-w-0">
          {/* Main Controls: Search, Tabs, Sort & View Mode */}
          <div className="relative z-20 flex flex-col gap-3 rounded-md border border-border bg-card/40 p-4 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Fiş içeriği, yazar veya eser adı ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Sort & View Mode Controls */}
              <div className="flex items-center gap-2 justify-end">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40 text-xs h-9">
                    <SlidersHorizontal className="h-3.5 w-3.5 mr-1 text-muted-foreground shrink-0" />
                    <SelectValue>{SORT_DISPLAY_LABELS[sortBy]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEWEST">En Yeni</SelectItem>
                    <SelectItem value="OLDEST">En Eski</SelectItem>
                    <SelectItem value="SOURCE_TITLE">Kaynağa Göre</SelectItem>
                    <SelectItem value="PAGE_NUMBER">
                      Sayfa Numarasına Göre
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center rounded-md border border-border/60 p-0.5 bg-muted/40">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-8 w-8 p-0"
                    title="Izgara Görünümü"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="h-8 w-8 p-0"
                    title="Liste Görünümü"
                  >
                    <ListIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Note Type Filter Tabs */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pt-1">
              <Tabs
                value={activeNoteTypeTab}
                onValueChange={setActiveNoteTypeTab}
                className="w-full"
              >
                <TabsList className="h-8 text-xs bg-muted">
                  <TabsTrigger value="ALL" className="text-xs px-3">
                    Tüm Notlar
                  </TabsTrigger>
                  <TabsTrigger value="DIRECT_QUOTE" className="text-xs px-3">
                    Doğrudan Alıntı
                  </TabsTrigger>
                  <TabsTrigger value="PARAPHRASE" className="text-xs px-3">
                    Dolaylı Alıntı
                  </TabsTrigger>
                  <TabsTrigger value="PERSONAL_NOTE" className="text-xs px-3">
                    Kişisel Not
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                {filteredCards.length} sonuç gösteriliyor
              </span>
            </div>
          </div>

          {/* Cards Display Grid / List */}
          {filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 rounded-md border border-dashed border-border bg-card/20 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
              <h3 className="font-serif text-base font-semibold text-foreground">
                Kriterlere Uygun Alıntı Fişi Bulunamadı
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Arama kelimenizi veya seçili kutu/not türü filtrelerinizi
                değiştirerek tekrar deneyin.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveNoteTypeTab("ALL");
                    setSelectedBoxId(null);
                    setSelectedSourceId(null);
                  }}
                  className="text-xs"
                >
                  Filtreleri Temizle
                </Button>
                <Button
                  size="sm"
                  onClick={handleOpenAddDialog}
                  className="text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Yeni Fiş Ekle
                </Button>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCards.map((card) => (
                <CitationCard
                  key={card.id}
                  card={card}
                  viewMode="grid"
                  availableBoxes={boxes}
                  onEdit={handleOpenEditDialog}
                  onDelete={handleDeleteCard}
                  onMoveBox={handleMoveBox}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredCards.map((card) => (
                <CitationCard
                  key={card.id}
                  card={card}
                  viewMode="list"
                  availableBoxes={boxes}
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
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        cardToEdit={cardToEdit}
        sources={sources}
        boxes={boxes}
        onSave={handleSaveCard}
      />
    </div>
  );
}
