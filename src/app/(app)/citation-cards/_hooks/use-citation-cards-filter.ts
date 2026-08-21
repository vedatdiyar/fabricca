"use client";

import { useCallback, useMemo, useState } from "react";
import { compareBoxTypes } from "@/lib/box-constants";
import type { CitationCardItem, CitationGroupBy } from "../_lib/types";

/** Filtering & sorting state for the citation cards page. */
export interface CitationCardFilters {
  selectedBoxId: number | null;
  selectedSourceId: number | null;
  selectedOutlineId: number | null;
  unassignedOnly: boolean;
  activeNoteTypeTab: string;
  searchQuery: string;
  sortBy: string;
  groupBy: CitationGroupBy;
}

/** Default (empty) filter values. */
export const DEFAULT_CARDS_FILTERS: CitationCardFilters = {
  selectedBoxId: null,
  selectedSourceId: null,
  selectedOutlineId: null,
  unassignedOnly: false,
  activeNoteTypeTab: "ALL",
  searchQuery: "",
  sortBy: "NEWEST",
  groupBy: "NONE",
};

/** Aggregated note-type counts for the overview metric cards. */
export interface CitationCardCounts {
  totalCount: number;
  assignedCount: number;
  unassignedCount: number;
  quoteCount: number;
  paraphraseCount: number;
  noteCount: number;
}

/**
 * Custom hook managing citation card filtering, search, sorting and note-type
 * metric counts. The memoized results fully track the source cards array so
 * they stay in sync after server-action refreshes.
 *
 * @param cards - The full list of citation cards.
 * @returns Filter state, setters and derived filtered cards / counts.
 */
export function useCitationCardsFilter(cards: CitationCardItem[]) {
  const [filters, setFilters] = useState<CitationCardFilters>(
    DEFAULT_CARDS_FILTERS,
  );

  const setFilter = useCallback(
    <K extends keyof CitationCardFilters>(
      key: K,
      value: CitationCardFilters[K],
    ) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_CARDS_FILTERS);
  }, []);

  const filteredCards = useMemo(() => {
    const {
      selectedBoxId,
      selectedSourceId,
      selectedOutlineId,
      unassignedOnly,
      activeNoteTypeTab,
      searchQuery,
      sortBy,
    } = filters;

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

        // Filter by outline section
        if (
          selectedOutlineId !== null &&
          !card.outlineIds.includes(selectedOutlineId)
        ) {
          return false;
        }

        // Filter by unassigned status
        if (unassignedOnly && card.outlineIds.length > 0) {
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
        // Primary sort: box category order (Problem → Teori → Yöntem → Birincil)
        // when viewing all boxes/sources and grouped by none/box.
        if (
          selectedBoxId === null &&
          selectedSourceId === null &&
          selectedOutlineId === null
        ) {
          const boxOrder = compareBoxTypes(a.boxType, b.boxType);
          if (boxOrder !== 0) return boxOrder;
        }

        // Secondary / existing sort
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
  }, [cards, filters]);

  const counts = useMemo<CitationCardCounts>(() => {
    const unassigned = cards.filter((c) => c.outlineIds.length === 0).length;
    const assigned = cards.length - unassigned;
    return {
      totalCount: cards.length,
      assignedCount: assigned,
      unassignedCount: unassigned,
      quoteCount: cards.filter((c) => c.noteType === "DIRECT_QUOTE").length,
      paraphraseCount: cards.filter((c) => c.noteType === "PARAPHRASE").length,
      noteCount: cards.filter((c) => c.noteType === "PERSONAL_NOTE").length,
    };
  }, [cards]);

  return {
    filters,
    setFilter,
    clearFilters,
    filteredCards,
    counts,
  };
}
