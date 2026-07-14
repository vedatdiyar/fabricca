"use client";

import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  GeminiThesisBox,
  LiteraturePoolEntry,
  JuryArticle,
} from "@/lib/types";
import { fetchBoxesWithFullShape } from "../../_services/fetch-actions";
import { useOnboardingNavigation } from "../../_hooks/use-onboarding-navigation";
import { fetchPreloadedLiteraturePool } from "../actions";

const boxOrderWeight: Record<string, number> = {
  PROBLEMATIZATION: 1,
  CONCEPTUAL: 2,
  CONTEXT: 3,
  DATA_PROTOCOL: 4,
  PRIMARY_MATERIAL: 5,
  RELATED_THESES: 6,
};

/** Processing status of a single sub-box within the literature review grid. */
export type BoxStatus = "idle" | "loading" | "done" | "error";

/** Shape returned by {@link useLiteratureReview}. */
export interface UseLiteratureReviewResult {
  subBoxes: GeminiThesisBox[];
  loading: boolean;
  processing: boolean;
  confirming: boolean;
  boxStatuses: Record<string, BoxStatus>;
  boxErrors: Record<string, string>;
  allProcessed: boolean;
  literaturePool: LiteraturePoolEntry[];
  archivalBoxes: Set<string>;
  addArchiveEntry: (
    subBoxTitle: string,
    thesisBoxId: number,
    entry: { title: string; description?: string },
  ) => void;
  handleFinalize: () => Promise<void>;
  setProcessing: (processing: boolean) => void;
  setBoxErrors: (
    errors:
      | Record<string, string>
      | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
}

/**
 * Orchestrates the literature-review step. On mount, checks whether
 * literature data already exists in the database. If it does, loads it
 * into state. Otherwise runs the full review pipeline (AI search across
 * all sub-boxes), persists results to the database, and displays them.
 *
 * Once the user is satisfied, {@link handleFinalize} sets the
 * `onboardingCompleted` flag and redirects to `/dashboard`.
 */
export function useLiteratureReview(): UseLiteratureReviewResult {
  const { finalizeLiterature } = useOnboardingNavigation();

  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [manualEntries, setManualEntries] = useState<
    { subBoxTitle: string; thesisBoxId: number; articles: JuryArticle[] }[]
  >([]);
  const [boxErrors, setBoxErrors] = useState<Record<string, string>>({});
  const [allProcessed, setAllProcessed] = useState(false);

  // Fetch boxes from DB via TanStack Query
  const { data: allBoxes, isLoading: boxesLoading } = useQuery({
    queryKey: ["boxes-full"],
    queryFn: fetchBoxesWithFullShape,
  });

  // Fetch literature pool from DB via TanStack Query
  const { data: initialPool, isLoading: poolLoading } = useQuery({
    queryKey: ["literature-pool"],
    queryFn: async () => {
      const res = await fetchPreloadedLiteraturePool();
      return res.data ?? [];
    },
  });

  // Derive sorted subBoxes directly from the query result
  const subBoxes = useMemo(() => {
    if (!allBoxes) return [];
    return [...allBoxes].sort((a, b) => {
      const weightA = boxOrderWeight[a.boxType] ?? 99;
      const weightB = boxOrderWeight[b.boxType] ?? 99;
      return weightA - weightB;
    });
  }, [allBoxes]);

  // Loading: true while the query is still in flight
  const loading = boxesLoading || poolLoading || allBoxes === undefined;

  // Merge initial pool with manually added entries
  const literaturePool = useMemo(() => {
    const pool = initialPool
      ? (JSON.parse(JSON.stringify(initialPool)) as LiteraturePoolEntry[])
      : [];
    for (const manual of manualEntries) {
      const idx = pool.findIndex((e) => e.subBoxTitle === manual.subBoxTitle);
      if (idx >= 0) {
        pool[idx] = {
          ...pool[idx],
          articles: [...pool[idx].articles, ...manual.articles],
        };
      } else {
        pool.push(manual);
      }
    }
    return pool;
  }, [initialPool, manualEntries]);

  // Derive archivalBoxes
  const archivalBoxes = useMemo(() => {
    const archivalSet = new Set<string>();
    for (const box of subBoxes) {
      if (
        box.boxType === "PRIMARY_MATERIAL" ||
        box.boxType === "RELATED_THESES"
      ) {
        archivalSet.add(box.title);
      }
    }
    return archivalSet;
  }, [subBoxes]);

  // Derive statuses
  const boxStatuses = useMemo(() => {
    const statuses: Record<string, BoxStatus> = {};
    for (const box of subBoxes) {
      const hasEntry = literaturePool.some(
        (entry) => entry.subBoxTitle === box.title,
      );
      statuses[box.title] = hasEntry ? "done" : "idle";
    }
    return statuses;
  }, [subBoxes, literaturePool]);

  const addArchiveEntry = useCallback(
    (
      subBoxTitle: string,
      thesisBoxId: number,
      entry: { title: string; description?: string },
    ) => {
      const archiveArticle: JuryArticle = {
        title: entry.title,
        comparisonNote:
          entry.description ??
          "Birincil arşiv belgesi — kullanıcı tarafından el ile girilmiştir.",
        badge: null,
        url: "",
        doi: null as string | null,
        publisher: "",
        publicationYear: 0,
        authors: [],
        isFoundational: true,
        relevanceScore: 100,
      };

      setManualEntries((prev) => {
        const existingIndex = prev.findIndex(
          (e) => e.thesisBoxId === thesisBoxId,
        );
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            articles: [...updated[existingIndex].articles, archiveArticle],
          };
          return updated;
        }
        return [
          ...prev,
          { subBoxTitle, thesisBoxId, articles: [archiveArticle] },
        ];
      });
    },
    [],
  );

  const handleFinalize = useCallback(async () => {
    setAllProcessed(true);

    if (literaturePool.length === 0) return;

    setConfirming(true);

    const archiveEntries = manualEntries;

    const result = await finalizeLiterature(archiveEntries);
    setConfirming(false);

    if ("error" in result && result.error) return;
  }, [literaturePool, manualEntries, finalizeLiterature]);

  return {
    subBoxes,
    loading,
    processing,
    confirming,
    boxStatuses,
    boxErrors,
    allProcessed,
    literaturePool,
    archivalBoxes,
    addArchiveEntry,
    handleFinalize,
    setProcessing,
    setBoxErrors,
  };
}
