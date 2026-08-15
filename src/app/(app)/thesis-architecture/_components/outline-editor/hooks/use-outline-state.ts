"use client";

import { useMemo, useState } from "react";
import { Outline } from "@/db/schema";
import { toast } from "sonner";

interface UseOutlineStateOptions {
  outlinesList: Outline[];
  initialLinkedBoxMap: Record<number, number[]>;
}

interface UseOutlineStateResult {
  selectedOutlineId: number | null;
  setSelectedOutlineId: (id: number | null) => void;
  selectedOutline: Outline | null;
  localLinkedBoxMap: Record<number, number[]>;
  applyBoxLinkOverride: (outlineId: number, linkedBoxIds: number[]) => void;
  treeSearchQuery: string;
  setTreeSearchQuery: (query: string) => void;
  sourceSearchQuery: string;
  setSourceSearchQuery: (query: string) => void;
  activeFocusedSourceIds: number[];
  toggleSourceFocus: (outlineId: number, sourceId: number) => void;
}

/**
 * Owns the outline editor selection, optimistic box-link overrides, tree/source
 * search filters and the per-section focused (starred) source map.
 *
 * @param root0 - Hook options.
 * @param root0.outlinesList - All outline sections of the thesis.
 * @param root0.initialLinkedBoxMap - Server-side box to outline link map.
 * @returns Selection, search, focus state and their mutators.
 */
export function useOutlineState({
  outlinesList,
  initialLinkedBoxMap,
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

  // Local optimistic overrides
  const [linkedBoxOverrides, setLinkedBoxOverrides] = useState<
    Record<number, number[]>
  >({});

  const localLinkedBoxMap = useMemo(
    () => ({ ...initialLinkedBoxMap, ...linkedBoxOverrides }),
    [initialLinkedBoxMap, linkedBoxOverrides],
  );

  const applyBoxLinkOverride = (outlineId: number, linkedBoxIds: number[]) => {
    setLinkedBoxOverrides((prev) => ({
      ...prev,
      [outlineId]: linkedBoxIds,
    }));
  };

  // Search state
  const [treeSearchQuery, setTreeSearchQuery] = useState("");
  const [sourceSearchQuery, setSourceSearchQuery] = useState("");

  // Section focused / starred sources (outlineId -> sourceIds)
  const [focusedSourceMap, setFocusedSourceMap] = useState<
    Record<number, number[]>
  >({});

  const activeFocusedSourceIds = useMemo(
    () => (selectedOutline ? (focusedSourceMap[selectedOutline.id] ?? []) : []),
    [selectedOutline, focusedSourceMap],
  );

  const toggleSourceFocus = (outlineId: number, sourceId: number) => {
    setFocusedSourceMap((prev) => {
      const current = prev[outlineId] ?? [];
      const updated = current.includes(sourceId)
        ? current.filter((id) => id !== sourceId)
        : [...current, sourceId];

      if (!current.includes(sourceId)) {
        toast.success("Kaynak bu bölüm için ana kaynak olarak öne çıkarıldı.");
      } else {
        toast.info("Ana kaynak işareti kaldırıldı.");
      }

      return {
        ...prev,
        [outlineId]: updated,
      };
    });
  };

  return {
    selectedOutlineId,
    setSelectedOutlineId,
    selectedOutline,
    localLinkedBoxMap,
    applyBoxLinkOverride,
    treeSearchQuery,
    setTreeSearchQuery,
    sourceSearchQuery,
    setSourceSearchQuery,
    activeFocusedSourceIds,
    toggleSourceFocus,
  };
}
