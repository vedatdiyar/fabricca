"use client";

import { useCallback, useEffect, useState } from "react";
import { getBoxHierarchyForLibraryAction } from "../actions";
import type { LibraryParentBoxOption } from "../box-actions";
import type { ThesisBoxType } from "../_lib/types";

interface UseBoxHierarchySelectionParams {
  /** Preferred sub-box id to restore once the hierarchy is loaded (edit flow). */
  initialSubBoxId?: number;
  /** Preferred parent box type to restore once the hierarchy is loaded (edit flow). */
  initialBoxType?: Exclude<ThesisBoxType, "ALL">;
}

interface BoxSelectionState {
  hierarchy: LibraryParentBoxOption[] | null;
  hierarchyError: string | null;
  selectedParentId: number | null;
  selectedSubBoxId: number | null;
}

/**
 * Loads the library box hierarchy once and manages the selected parent/sub-box
 * selection. When an initial sub-box or box type is provided (edit flow), the
 * selection is restored after the hierarchy arrives; otherwise the first parent
 * and its first child are selected (add flow).
 *
 * @param params - Optional initial selection preferences.
 * @param params.initialSubBoxId - Preferred sub-box id to restore.
 * @param params.initialBoxType - Preferred parent box type to restore.
 * @returns Hierarchy state plus selection values and selectors.
 */
export function useBoxHierarchySelection({
  initialSubBoxId,
  initialBoxType,
}: UseBoxHierarchySelectionParams = {}) {
  const [state, setState] = useState<BoxSelectionState>({
    hierarchy: null,
    hierarchyError: null,
    selectedParentId: null,
    selectedSubBoxId: null,
  });

  useEffect(() => {
    let cancelled = false;

    /**
     * Loads the parent box hierarchy and restores the requested selection.
     */
    async function loadHierarchy() {
      const res = await getBoxHierarchyForLibraryAction();
      if (cancelled) return;

      if (res.success) {
        let foundParent: LibraryParentBoxOption | undefined;
        let foundSubId: number | null = null;

        if (initialSubBoxId !== undefined) {
          foundParent = res.data.find((p) =>
            p.children.some((c) => c.id === initialSubBoxId),
          );
          if (foundParent) {
            foundSubId = initialSubBoxId;
          }
        }

        if (!foundParent && initialBoxType) {
          foundParent = res.data.find((p) => p.boxType === initialBoxType);
        }

        let selectedParentId: number | null = null;
        let selectedSubBoxId: number | null = null;

        if (foundParent) {
          selectedParentId = foundParent.id;
          selectedSubBoxId =
            foundSubId ??
            (foundParent.children.length > 0
              ? foundParent.children[0].id
              : null);
        } else if (res.data.length > 0) {
          selectedParentId = res.data[0].id;
          selectedSubBoxId =
            res.data[0].children.length > 0 ? res.data[0].children[0].id : null;
        }

        setState({
          hierarchy: res.data,
          hierarchyError: null,
          selectedParentId,
          selectedSubBoxId,
        });
      } else {
        setState((prev) => ({
          ...prev,
          hierarchyError: res.error || "Kutu listesi yüklenirken hata oluştu.",
        }));
      }
    }

    loadHierarchy();

    return () => {
      cancelled = true;
    };
  }, [initialSubBoxId, initialBoxType]);

  const setParentId = useCallback((parentId: number) => {
    setState((prev) => {
      const parent = prev.hierarchy?.find((b) => b.id === parentId);
      return {
        ...prev,
        selectedParentId: parentId,
        selectedSubBoxId:
          parent && parent.children.length > 0 ? parent.children[0].id : null,
      };
    });
  }, []);

  const setSubBoxId = useCallback((subBoxId: number | null) => {
    setState((prev) => ({ ...prev, selectedSubBoxId: subBoxId }));
  }, []);

  return {
    hierarchy: state.hierarchy,
    hierarchyError: state.hierarchyError,
    selectedParentId: state.selectedParentId,
    selectedSubBoxId: state.selectedSubBoxId,
    isLoading: state.hierarchy === null && state.hierarchyError === null,
    setParentId,
    setSubBoxId,
  };
}
