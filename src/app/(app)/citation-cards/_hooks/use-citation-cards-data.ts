"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getCitationCardsDataAction } from "../actions";
import type {
  BoxItem,
  CitationCardItem,
  OutlineItem,
  SourceItem,
} from "../_lib/types";

interface CitationCardsData {
  cards: CitationCardItem[];
  boxes: BoxItem[];
  sources: SourceItem[];
  outlines: OutlineItem[];
}

const EMPTY_DATA: CitationCardsData = {
  cards: [],
  boxes: [],
  sources: [],
  outlines: [],
};

/**
 * Owns the citation cards workbench dataset: initial fetch, manual refresh
 * and local card removal after deletion.
 *
 * @returns Data state, loading flag and mutation helpers
 */
export function useCitationCardsData() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<CitationCardsData>(EMPTY_DATA);

  const applyResult = useCallback(
    (res: Awaited<ReturnType<typeof getCitationCardsDataAction>>) => {
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
    },
    [],
  );

  /**
   * Refreshes citation cards data from database.
   */
  const refreshData = useCallback(async () => {
    applyResult(await getCitationCardsDataAction());
  }, [applyResult]);

  useEffect(() => {
    let isMounted = true;
    getCitationCardsDataAction().then((res) => {
      if (!isMounted) return;
      applyResult(res);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [applyResult]);

  /**
   * Removes a deleted card from the local state without refetching.
   *
   * @param id - ID of the deleted card
   */
  const removeCardLocally = useCallback((id: number) => {
    setData((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== id),
    }));
  }, []);

  return { isLoading, data, refreshData, removeCardLocally };
}
