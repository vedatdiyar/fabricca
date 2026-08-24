"use client";

import { useMemo, useCallback } from "react";
import { Outline, Annotation, Source } from "@/core/db/schema";
import {
  filterRootOutlinesByQuery,
  filterSourcesByQuery,
} from "../utils/outline-helpers";

export interface OutlineMetrics {
  totalRoots: number;
  totalSubs: number;
  totalSources: number;
  totalCards: number;
}

interface UseOutlineMetricsOptions {
  outlinesList: Outline[];
  sourcesList: Source[];
  annotationsList: (Annotation & { source?: Source })[];
  localPinnedAnnotationsMap: Record<number, number[]>;
  localLinkedSourcesMap: Record<number, number[]>;
  selectedOutline: Outline | null;
  treeSearchQuery: string;
  sourceSearchQuery: string;
}

interface UseOutlineMetricsResult {
  rootOutlines: Outline[];
  subOutlines: Outline[];
  getSubOutlines: (parentId: number) => Outline[];
  metrics: OutlineMetrics;
  sectionSourceIds: number[];
  sectionPinnedAnnotationIds: number[];
  sectionAnnotations: (Annotation & { source?: Source })[];
  sectionSources: Source[];
  displayedSources: Source[];
  sourceCountMap: Record<number, number>;
  cardCountMap: Record<number, number>;
  filteredRootOutlines: Outline[];
  isParentWithChildren: boolean;
  groupedSubSectionAnnotations: {
    outline: Outline;
    annotations: (Annotation & { source?: Source })[];
  }[];
  selectedOutlineTotalCards: number;
}

/**
 * Derives the outline hierarchy, top metric strip values and all filtered
 * section data (pinned citation cards, linked sources, search results) from
 * the direct annotation/source to outline link maps.
 *
 * @param root0 - Hook options.
 * @param root0.outlinesList - All outline sections of the thesis.
 * @param root0.sourcesList - All library sources of the thesis.
 * @param root0.annotationsList - All citation cards with their sources.
 * @param root0.localPinnedAnnotationsMap - Effective annotation to outline link map (with optimistic overrides).
 * @param root0.localLinkedSourcesMap - Effective source to outline link map (with optimistic overrides).
 * @param root0.selectedOutline - The currently selected outline section or null.
 * @param root0.treeSearchQuery - The tree search query.
 * @param root0.sourceSearchQuery - The linked sources search query.
 * @returns The derived hierarchy, metrics and filtered lists.
 */
export function useOutlineMetrics({
  outlinesList,
  sourcesList,
  annotationsList,
  localPinnedAnnotationsMap,
  localLinkedSourcesMap,
  selectedOutline,
  treeSearchQuery,
  sourceSearchQuery,
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

  const getSubOutlines = useCallback(
    (parentId: number) =>
      outlinesList
        .filter((o) => o.parentId === parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [outlinesList],
  );

  // sourceId lookup for pinned annotations
  const sourceIdByAnnotation = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of annotationsList) map.set(a.id, a.sourceId);
    return map;
  }, [annotationsList]);

  // Distinct source count per outline with roll-up for parent chapters
  const sourceCountMap = useMemo(() => {
    const directSources: Record<number, Set<number>> = {};
    const outlineIds = new Set<number>([
      ...outlinesList.map((o) => o.id),
      ...Object.keys(localLinkedSourcesMap).map(Number),
      ...Object.keys(localPinnedAnnotationsMap).map(Number),
    ]);

    for (const odId of outlineIds) {
      const linked = localLinkedSourcesMap[odId] ?? [];
      const pinned = localPinnedAnnotationsMap[odId] ?? [];
      const sources = new Set<number>(linked);
      for (const annId of pinned) {
        const srcId = sourceIdByAnnotation.get(annId);
        if (srcId) sources.add(srcId);
      }
      directSources[odId] = sources;
    }

    const map: Record<number, number> = {};
    for (const root of rootOutlines) {
      const children = getSubOutlines(root.id);
      const rootSet = new Set<number>(directSources[root.id] ?? []);
      for (const child of children) {
        const childSet = directSources[child.id] ?? new Set<number>();
        for (const src of childSet) rootSet.add(src);
      }
      map[root.id] = rootSet.size;
    }

    for (const sub of subOutlines) {
      map[sub.id] = (directSources[sub.id] ?? new Set<number>()).size;
    }

    return map;
  }, [
    outlinesList,
    rootOutlines,
    subOutlines,
    getSubOutlines,
    localLinkedSourcesMap,
    localPinnedAnnotationsMap,
    sourceIdByAnnotation,
  ]);

  // Citation card count per outline with roll-up for parent chapters
  const cardCountMap = useMemo(() => {
    const directCounts: Record<number, number> = {};
    for (const o of outlinesList) {
      directCounts[o.id] = 0;
    }
    for (const [key, ids] of Object.entries(localPinnedAnnotationsMap)) {
      directCounts[Number(key)] = ids.length;
    }

    const map: Record<number, number> = { ...directCounts };
    for (const root of rootOutlines) {
      const children = getSubOutlines(root.id);
      const direct = directCounts[root.id] || 0;
      if (children.length > 0) {
        const childrenSum = children.reduce(
          (sum, child) => sum + (directCounts[child.id] || 0),
          0,
        );
        map[root.id] = direct + childrenSum;
      } else {
        map[root.id] = direct;
      }
    }

    for (const sub of subOutlines) {
      map[sub.id] = directCounts[sub.id] || 0;
    }

    return map;
  }, [
    outlinesList,
    rootOutlines,
    subOutlines,
    getSubOutlines,
    localPinnedAnnotationsMap,
  ]);

  // Top metrics computation
  const metrics = useMemo(() => {
    const totalRoots = rootOutlines.length;
    const totalSubs = subOutlines.length;

    const allSourceIds = new Set<number>();
    for (const ids of Object.values(localLinkedSourcesMap)) {
      for (const id of ids) allSourceIds.add(id);
    }
    for (const ids of Object.values(localPinnedAnnotationsMap)) {
      for (const annId of ids) {
        const srcId = sourceIdByAnnotation.get(annId);
        if (srcId) allSourceIds.add(srcId);
      }
    }
    const totalSources = allSourceIds.size;

    const totalCards = Object.values(localPinnedAnnotationsMap).reduce(
      (sum, ids) => sum + ids.length,
      0,
    );

    return {
      totalRoots,
      totalSubs,
      totalSources,
      totalCards,
    };
  }, [
    rootOutlines,
    subOutlines,
    localLinkedSourcesMap,
    localPinnedAnnotationsMap,
    sourceIdByAnnotation,
  ]);

  // Selected outline relations
  const sectionSourceIds = useMemo(
    () =>
      selectedOutline ? (localLinkedSourcesMap[selectedOutline.id] ?? []) : [],
    [selectedOutline, localLinkedSourcesMap],
  );

  const sectionPinnedAnnotationIds = useMemo(
    () =>
      selectedOutline
        ? (localPinnedAnnotationsMap[selectedOutline.id] ?? [])
        : [],
    [selectedOutline, localPinnedAnnotationsMap],
  );

  // Citation cards pinned directly to the selected outline section
  const sectionAnnotations = useMemo(
    () =>
      annotationsList.filter((a) => sectionPinnedAnnotationIds.includes(a.id)),
    [annotationsList, sectionPinnedAnnotationIds],
  );

  // Check if selected outline is a parent chapter with sub-sections
  const isParentWithChildren = useMemo(() => {
    if (!selectedOutline || selectedOutline.parentId) return false;
    return getSubOutlines(selectedOutline.id).length > 0;
  }, [selectedOutline, getSubOutlines]);

  // Grouped sub-section annotations for panoramic overview
  const groupedSubSectionAnnotations = useMemo(() => {
    if (!selectedOutline || selectedOutline.parentId) return [];
    const children = getSubOutlines(selectedOutline.id);
    return children.map((child) => {
      const pinnedIds = localPinnedAnnotationsMap[child.id] ?? [];
      const annotations = annotationsList.filter((a) =>
        pinnedIds.includes(a.id),
      );
      return {
        outline: child,
        annotations,
      };
    });
  }, [
    selectedOutline,
    getSubOutlines,
    localPinnedAnnotationsMap,
    annotationsList,
  ]);

  const selectedOutlineTotalCards = useMemo(() => {
    if (!selectedOutline) return 0;
    return cardCountMap[selectedOutline.id] ?? 0;
  }, [selectedOutline, cardCountMap]);

  // Sources directly linked to the selected outline section
  const sectionSources = useMemo(
    () => sourcesList.filter((s) => sectionSourceIds.includes(s.id)),
    [sourcesList, sectionSourceIds],
  );

  // Filtered & displayed sources
  const displayedSources = useMemo(
    () => filterSourcesByQuery(sectionSources, sourceSearchQuery),
    [sectionSources, sourceSearchQuery],
  );

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
    sectionSourceIds,
    sectionPinnedAnnotationIds,
    sectionAnnotations,
    sectionSources,
    displayedSources,
    sourceCountMap,
    cardCountMap,
    filteredRootOutlines,
    isParentWithChildren,
    groupedSubSectionAnnotations,
    selectedOutlineTotalCards,
  };
}
