"use client";

import { useMemo, useState } from "react";
import { Outline } from "@/core/db/schema";

interface UseOutlineStateOptions {
  outlinesList: Outline[];
  initialPinnedAnnotationsMap: Record<number, number[]>;
  initialLinkedSourcesMap: Record<number, number[]>;
}

interface UseOutlineStateResult {
  selectedOutlineId: number | null;
  setSelectedOutlineId: (id: number | null) => void;
  selectedOutline: Outline | null;
  localPinnedAnnotationsMap: Record<number, number[]>;
  applyAnnotationLinkOverride: (
    outlineId: number,
    annotationIds: number[],
  ) => void;
  localLinkedSourcesMap: Record<number, number[]>;
  applySourceLinkOverride: (outlineId: number, sourceIds: number[]) => void;
  treeSearchQuery: string;
  setTreeSearchQuery: (query: string) => void;
  sourceSearchQuery: string;
  setSourceSearchQuery: (query: string) => void;
}

/**
 * Owns the outline editor selection, optimistic annotation/source link
 * overrides and the tree/source search filters.
 *
 * @param root0 - Hook options.
 * @param root0.outlinesList - All outline sections of the thesis.
 * @param root0.initialPinnedAnnotationsMap - Server-side annotation to outline link map.
 * @param root0.initialLinkedSourcesMap - Server-side source to outline link map.
 * @returns Selection, search state and their mutators.
 */
export function useOutlineState({
  outlinesList,
  initialPinnedAnnotationsMap,
  initialLinkedSourcesMap,
}: UseOutlineStateOptions): UseOutlineStateResult {
  // Selected outline state (derived with user override)
  const [userSelectedOutlineId, setUserSelectedOutlineId] = useState<
    number | null
  >(null);

  const selectedOutlineId = useMemo(() => {
    if (
      userSelectedOutlineId &&
      outlinesList.some((o) => o.id === userSelectedOutlineId)
    ) {
      return userSelectedOutlineId;
    }
    return outlinesList.length > 0 ? outlinesList[0].id : null;
  }, [userSelectedOutlineId, outlinesList]);

  const setSelectedOutlineId = (id: number | null) => {
    setUserSelectedOutlineId(id);
  };

  const selectedOutline = useMemo(
    () => outlinesList.find((o) => o.id === selectedOutlineId) ?? null,
    [outlinesList, selectedOutlineId],
  );

  // Local optimistic overrides for annotation (citation card) links
  const [annotationLinkOverrides, setAnnotationLinkOverrides] = useState<
    Record<number, number[]>
  >({});

  const localPinnedAnnotationsMap = useMemo(
    () => ({ ...initialPinnedAnnotationsMap, ...annotationLinkOverrides }),
    [initialPinnedAnnotationsMap, annotationLinkOverrides],
  );

  const applyAnnotationLinkOverride = (
    outlineId: number,
    annotationIds: number[],
  ) => {
    setAnnotationLinkOverrides((prev) => ({
      ...prev,
      [outlineId]: annotationIds,
    }));
  };

  // Local optimistic overrides for source links
  const [sourceLinkOverrides, setSourceLinkOverrides] = useState<
    Record<number, number[]>
  >({});

  const localLinkedSourcesMap = useMemo(
    () => ({ ...initialLinkedSourcesMap, ...sourceLinkOverrides }),
    [initialLinkedSourcesMap, sourceLinkOverrides],
  );

  const applySourceLinkOverride = (outlineId: number, sourceIds: number[]) => {
    setSourceLinkOverrides((prev) => ({
      ...prev,
      [outlineId]: sourceIds,
    }));
  };

  // Search state
  const [treeSearchQuery, setTreeSearchQuery] = useState("");
  const [sourceSearchQuery, setSourceSearchQuery] = useState("");

  return {
    selectedOutlineId,
    setSelectedOutlineId,
    selectedOutline,
    localPinnedAnnotationsMap,
    applyAnnotationLinkOverride,
    localLinkedSourcesMap,
    applySourceLinkOverride,
    treeSearchQuery,
    setTreeSearchQuery,
    sourceSearchQuery,
    setSourceSearchQuery,
  };
}
