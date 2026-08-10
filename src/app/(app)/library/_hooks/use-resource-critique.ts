"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  getLibraryResourcesAction,
  saveResourceCritiqueAction,
} from "../actions";
import type { LibraryResourceCritique } from "../_lib/types";

interface UseResourceCritiqueParams {
  selectedResourceId: number | null;
}

export interface CritiqueFormInput {
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  mainArgument: string;
  literatureGap: string;
}

/**
 * Manages the 1:1 article analysis (Eser Analizi) state and save operation for the currently selected resource.
 *
 * @param params - The currently selected resource ID.
 * @param params.selectedResourceId - The ID of the resource whose analysis is managed.
 * @returns Critiques list, state setter, lookup helper, and save handler.
 */
export function useResourceCritique({
  selectedResourceId,
}: UseResourceCritiqueParams) {
  const [critiques, setCritiques] = useState<LibraryResourceCritique[]>([]);

  useEffect(() => {
    /**
     * Loads critiques from the server on initial mount.
     */
    async function loadCritiques() {
      try {
        const res = await getLibraryResourcesAction();
        if (res.success && res.data) {
          setCritiques(res.data.critiques);
        }
      } catch {}
    }

    loadCritiques();
  }, []);

  const getCritiqueFor = useCallback(
    (resourceId: number | null) =>
      critiques.find((c) => c.resourceId === resourceId),
    [critiques],
  );

  const handleSaveCritique = useCallback(
    async (input: CritiqueFormInput) => {
      if (!selectedResourceId) return;

      const res = await saveResourceCritiqueAction({
        resourceId: selectedResourceId,
        ...input,
      });

      if (res.success && res.data) {
        setCritiques((prev) => [
          res.data,
          ...prev.filter((c) => c.resourceId !== res.data?.resourceId),
        ]);
        toast.success("Eser analizi kaydedildi.");
      } else {
        toast.error(res.error || "Eser analizi kaydedilirken hata oluştu.");
      }
    },
    [selectedResourceId],
  );

  return {
    critiques,
    setCritiques,
    getCritiqueFor,
    handleSaveCritique,
  };
}
