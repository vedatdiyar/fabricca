"use client";

import { useMemo } from "react";
import { Outline, Box, Source } from "@/db/schema";
import {
  filterRootOutlinesByQuery,
  filterSourcesByQuery,
} from "../utils/outline-helpers";

export interface OutlineMetrics {
  totalRoots: number;
  totalSubs: number;
  totalSources: number;
}

interface UseOutlineMetricsOptions {
  outlinesList: Outline[];
  boxesList: Box[];
  sourcesList: Source[];
  localLinkedBoxMap: Record<number, number[]>;
  selectedOutline: Outline | null;
  treeSearchQuery: string;
  sourceSearchQuery: string;
  activeFocusedSourceIds: number[];
}

interface UseOutlineMetricsResult {
  rootOutlines: Outline[];
  subOutlines: Outline[];
  getSubOutlines: (parentId: number) => Outline[];
  metrics: OutlineMetrics;
  activeLinkedBoxIds: number[];
  sectionBoxes: Box[];
  sectionSources: Source[];
  displayedSources: Source[];
  filteredRootOutlines: Outline[];
}

/**
 * Derives the outline hierarchy, top metric strip values and all filtered
 * section data (boxes, sources, search results) from raw list props.
 *
 * @param root0 - Hook options.
 * @param root0.outlinesList - All outline sections of the thesis.
 * @param root0.boxesList - All thesis topic boxes.
 * @param root0.sourcesList - All library sources of the thesis.
 * @param root0.localLinkedBoxMap - Effective box to outline link map (with optimistic overrides).
 * @param root0.selectedOutline - The currently selected outline section or null.
 * @param root0.treeSearchQuery - The tree search query.
 * @param root0.sourceSearchQuery - The sources search query.
 * @param root0.activeFocusedSourceIds - Focused source ids of the selected section.
 * @returns The derived hierarchy, metrics and filtered lists.
 */
export function useOutlineMetrics({
  outlinesList,
  boxesList,
  sourcesList,
  localLinkedBoxMap,
  selectedOutline,
  treeSearchQuery,
  sourceSearchQuery,
  activeFocusedSourceIds,
}: UseOutlineMetricsOptions): UseOutlineMetricsResult {
  // Hierarchy derivation
  const rootOutlines = useMemo(
    () =>
      outlinesList
        .filter((o) => !o.parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [outlinesList],
  );

  const subOutlines = useMemo(
    () => outlinesList.filter((o) => Boolean(o.parentId)),
    [outlinesList],
  );

  const getSubOutlines = (parentId: number) =>
    outlinesList
      .filter((o) => o.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  // Top metrics computation
  const metrics = useMemo(() => {
    const totalRoots = rootOutlines.length;
    const totalSubs = subOutlines.length;

    // Count all distinct sources linked through all outlines
    const allLinkedBoxIds = new Set<number>();
    for (const boxIdList of Object.values(localLinkedBoxMap)) {
      for (const bId of boxIdList) {
        allLinkedBoxIds.add(bId);
      }
    }

    const totalSources = sourcesList.filter((s) =>
      s.boxId ? allLinkedBoxIds.has(s.boxId) : false,
    ).length;

    return {
      totalRoots,
      totalSubs,
      totalSources,
    };
  }, [rootOutlines, subOutlines, localLinkedBoxMap, sourcesList]);

  // Selected outline relations
  const activeLinkedBoxIds = useMemo(
    () =>
      selectedOutline ? (localLinkedBoxMap[selectedOutline.id] ?? []) : [],
    [selectedOutline, localLinkedBoxMap],
  );

  // Linked Box objects for the selected outline
  const sectionBoxes = useMemo(
    () => boxesList.filter((b) => activeLinkedBoxIds.includes(b.id)),
    [boxesList, activeLinkedBoxIds],
  );

  // Sources belonging to the boxes linked to this selected outline section
  const sectionSources = useMemo(
    () =>
      sourcesList.filter((s) =>
        s.boxId ? activeLinkedBoxIds.includes(s.boxId) : false,
      ),
    [sourcesList, activeLinkedBoxIds],
  );

  // Filtered & sorted sources
  const displayedSources = useMemo(() => {
    const filtered = filterSourcesByQuery(sectionSources, sourceSearchQuery);

    return filtered.sort((a, b) => {
      const aFocused = activeFocusedSourceIds.includes(a.id);
      const bFocused = activeFocusedSourceIds.includes(b.id);
      if (aFocused && !bFocused) return -1;
      if (!aFocused && bFocused) return 1;
      return 0;
    });
  }, [sectionSources, sourceSearchQuery, activeFocusedSourceIds]);

  // Tree filter logic
  const filteredRootOutlines = useMemo(
    () =>
      filterRootOutlinesByQuery(rootOutlines, outlinesList, treeSearchQuery),
    [rootOutlines, outlinesList, treeSearchQuery],
  );

  return {
    rootOutlines,
    subOutlines,
    getSubOutlines,
    metrics,
    activeLinkedBoxIds,
    sectionBoxes,
    sectionSources,
    displayedSources,
    filteredRootOutlines,
  };
}
