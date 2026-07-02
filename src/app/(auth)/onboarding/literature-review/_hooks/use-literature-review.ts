"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  GeminiThesisBox,
  LiteraturePoolEntry,
  JuryArticle,
} from "@/lib/types";
import { fetchBoxesWithFullShape } from "../../_lib/fetch-actions";
import type { SubBoxInput } from "../_services/literature-review-papers";

const boxOrderWeight: Record<string, number> = {
  PROBLEMATIZATION: 1,
  CONCEPTUAL: 2,
  DATA_PROTOCOL: 3,
  PRIMARY_MATERIAL: 4,
  CONTEXT: 5,
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
    entry: { title: string; description?: string },
  ) => void;
  handleFinalize: () => Promise<void>;
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
  const router = useRouter();
  const queryClient = useQueryClient();

  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [literaturePool, setLiteraturePool] = useState<LiteraturePoolEntry[]>(
    [],
  );
  const [boxResults, setBoxResults] = useState<{
    statuses: Record<string, BoxStatus>;
    errors: Record<string, string>;
  }>({ statuses: {}, errors: {} });
  const [archivalBoxes, setArchivalBoxes] = useState<Set<string>>(new Set());

  const hasRunRef = useRef(false);

  // Fetch boxes from DB via TanStack Query
  const { data: allBoxes, isLoading: boxesLoading } = useQuery({
    queryKey: ["boxes-full"],
    queryFn: fetchBoxesWithFullShape,
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
  const loading = boxesLoading || allBoxes === undefined;

  // ------------------------------------------------------------------
  // Auto-run the literature review pipeline on first mount (only when
  // boxes are loaded and no data has been persisted yet).
  // ------------------------------------------------------------------
  useEffect(() => {
    if (loading) return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const runPipeline = async () => {
      const {
        processAllBoxesAction,
        confirmLiteratureAction,
        fetchPreloadedLiteraturePool,
      } = await import("../actions");

      // Check if data already exists in the database.
      const existing = await fetchPreloadedLiteraturePool();
      if (existing.data && existing.data.length > 0) {
        setLiteraturePool(existing.data);

        const statuses: Record<string, BoxStatus> = {};
        for (const box of subBoxes) {
          statuses[box.title] = "done";
        }
        setBoxResults({ statuses, errors: {} });

        const archivalSet = new Set<string>();
        for (const box of subBoxes) {
          if (
            box.boxType === "PRIMARY_MATERIAL" ||
            box.boxType === "RELATED_THESES"
          ) {
            archivalSet.add(box.title);
          }
        }
        setArchivalBoxes(archivalSet);

        return;
      }

      // No existing data — run the full pipeline.
      setProcessing(true);

      const statuses: Record<string, BoxStatus> = {};
      const errors: Record<string, string> = {};
      for (const box of subBoxes) {
        statuses[box.title] = "loading";
      }
      setBoxResults({ statuses, errors });

      try {
        const subBoxInputs: SubBoxInput[] = (allBoxes ?? []).map((box) => ({
          title: box.title,
          description: box.description,
          boxType: box.boxType,
          subBoxes: (box.subBoxes ?? []).map((sb) => ({
            title: sb.title,
            semanticQuery: sb.semanticQuery ?? "",
            foundationalQueries: sb.foundationalQueries ?? [],
          })),
          foundationalQueries: (box.subBoxes ?? []).flatMap(
            (sb) => sb.foundationalQueries ?? [],
          ),
        }));

        const processResult = await processAllBoxesAction(
          subBoxInputs,
          undefined,
        );

        if (processResult.error) {
          for (const box of subBoxes) {
            statuses[box.title] = "error";
            errors[box.title] = processResult.error;
          }
          setBoxResults({ statuses, errors });
          setProcessing(false);
          toast.error(processResult.error);
          return;
        }

        const pool = processResult.data!;

        // Persist results to the database (without onboardingCompleted).
        const confirmResult = await confirmLiteratureAction({
          literaturePool: pool,
        });

        if ("error" in confirmResult && confirmResult.error) {
          for (const box of subBoxes) {
            statuses[box.title] = "error";
            errors[box.title] = confirmResult.error;
          }
          setBoxResults({ statuses, errors });
          setProcessing(false);
          toast.error(confirmResult.error);
          return;
        }

        // Mark all boxes as done.
        for (const box of subBoxes) {
          statuses[box.title] = "done";
        }
        setBoxResults({ statuses, errors });
        setLiteraturePool(pool);

        const archivalSet = new Set<string>();
        for (const box of subBoxes) {
          if (
            box.boxType === "PRIMARY_MATERIAL" ||
            box.boxType === "RELATED_THESES"
          ) {
            archivalSet.add(box.title);
          }
        }
        setArchivalBoxes(archivalSet);
      } catch (err) {
        for (const box of subBoxes) {
          statuses[box.title] = "error";
          errors[box.title] =
            err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
        }
        setBoxResults({ statuses, errors });
        toast.error(
          err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
        );
      } finally {
        setProcessing(false);
      }
    };

    void runPipeline();
  }, [loading, subBoxes, allBoxes]);

  const addArchiveEntry = useCallback(
    (subBoxTitle: string, entry: { title: string; description?: string }) => {
      const archiveArticle: JuryArticle = {
        title: entry.title,
        abstract:
          entry.description ??
          "Birincil arşiv belgesi — kullanıcı tarafından el ile girilmiştir.",
        url: "",
        doi: null as string | null,
        publisher: "",
        publicationYear: 0,
        authors: [],
        isFoundational: true,
        relevanceScore: 100,
      };

      setLiteraturePool((prev) => {
        const existingIndex = prev.findIndex(
          (e) => e.subBoxTitle === subBoxTitle,
        );
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            articles: [...updated[existingIndex].articles, archiveArticle],
          };
          return updated;
        }
        return [...prev, { subBoxTitle, articles: [archiveArticle] }];
      });
    },
    [],
  );

  const allProcessed = useMemo(() => {
    if (subBoxes.length === 0) return false;
    return subBoxes.every((box) => {
      if (archivalBoxes.has(box.title)) {
        const entry = literaturePool.find((e) => e.subBoxTitle === box.title);
        return entry !== undefined;
      }
      return literaturePool.some((entry) => entry.subBoxTitle === box.title);
    });
  }, [subBoxes, literaturePool, archivalBoxes]);

  const handleFinalize = useCallback(async () => {
    if (literaturePool.length === 0) {
      toast.error("Henüz işlenmiş literatür verisi bulunamadı.");
      return;
    }

    setConfirming(true);

    try {
      const { finalizeOnboardingAction, appendArchiveEntriesAction } =
        await import("../actions");

      // Persist any archive entries the user added to the database.
      const archiveEntries = literaturePool.filter((e) =>
        archivalBoxes.has(e.subBoxTitle),
      );

      if (archiveEntries.length > 0) {
        const result = await appendArchiveEntriesAction({
          entries: archiveEntries,
        });
        if ("error" in result && result.error) {
          toast.error(result.error);
          setConfirming(false);
          return;
        }
      }

      const result = await finalizeOnboardingAction();
      if ("error" in result && result.error) {
        toast.error(result.error);
        setConfirming(false);
        return;
      }

      setLiteraturePool([]);
      setConfirming(false);
      queryClient.invalidateQueries();
      toast.success("Tebrikler! Onboarding süreciniz tamamlandı.");
      router.push("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
      setConfirming(false);
    }
  }, [literaturePool, archivalBoxes, queryClient, router]);

  return {
    subBoxes,
    loading,
    processing,
    confirming,
    boxStatuses: boxResults.statuses,
    boxErrors: boxResults.errors,
    allProcessed,
    literaturePool,
    archivalBoxes,
    addArchiveEntry,
    handleFinalize,
  };
}
