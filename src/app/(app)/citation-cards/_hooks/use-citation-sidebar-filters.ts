"use client";

import { useCallback, useMemo, useState } from "react";
import { compareBoxTypes, type ThesisBoxType } from "@/lib/box-constants";
import type { BoxItem, SourceItem } from "../_lib/types";

/** Active box-type tab: either a concrete type or "ALL". */
export type BoxTypeTab = ThesisBoxType | "ALL";

/** Default sidebar tab selection. */
export const DEFAULT_BOX_TYPE_TAB: BoxTypeTab = "ALL";

/**
 * Manages the citation sidebar search, box-type tab and derived filtered
 * box/source lists. Both derived lists stay memoized on their inputs so they
 * refresh whenever the boxes, sources or active selection changes.
 *
 * @param boxes - All topic boxes of the thesis.
 * @param sources - All library sources of the thesis.
 * @param selectedBoxId - The currently selected box id or null.
 * @returns Filter state, setters and derived filtered lists.
 */
export function useCitationSidebarFilters(
  boxes: BoxItem[],
  sources: SourceItem[],
  selectedBoxId: number | null,
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<BoxTypeTab>(DEFAULT_BOX_TYPE_TAB);

  const filteredBoxes = useMemo(() => {
    return boxes
      .filter((box) => {
        const matchesTab = activeTab === "ALL" || box.boxType === activeTab;
        const matchesQuery =
          searchQuery.trim() === "" ||
          box.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesQuery;
      })
      .sort((a, b) => compareBoxTypes(a.boxType, b.boxType));
  }, [boxes, activeTab, searchQuery]);

  const filteredSources = useMemo(() => {
    const scopeSources = selectedBoxId
      ? sources.filter((s) => s.boxId === selectedBoxId)
      : sources;

    if (!searchQuery.trim()) return scopeSources;

    return scopeSources.filter(
      (s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.authors.some((a) =>
          a.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    );
  }, [sources, selectedBoxId, searchQuery]);

  const resetSidebarFilters = useCallback(() => {
    setActiveTab(DEFAULT_BOX_TYPE_TAB);
    setSearchQuery("");
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    filteredBoxes,
    filteredSources,
    resetSidebarFilters,
  };
}