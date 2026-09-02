"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { GeminiThesisBox, LiteraturePoolEntry } from "@/lib/types";
import { handleActionErrorToast } from "@/lib/errors/ui-error-handler";
import {
  fetchBoxesWithFullShape,
  fetchUncachedBoxesWithFullShape,
} from "@/app/(onboarding)/onboarding/_services/fetch-actions";
import { useLiteratureContinue } from "../../_hooks/use-literature-continue";
import {
  fetchPreloadedLiteraturePool,
  runLiteraturePipelineAction,
} from "../actions";
import type { SubBoxInput } from "@/app/(onboarding)/onboarding/literature-review/_services/literature-review-papers";
import { compareBoxTypes } from "@/lib/box-constants";

/** Processing status of a single sub-box within the literature review grid. */
export type BoxStatus =
  | "idle"
  | "loading"
  | "done"
  | "error"
  | "manual_entry_required";

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
  handleFinalize: () => Promise<void>;
  retryReview: () => Promise<void>;
  setProcessing: (processing: boolean) => void;
  setBoxErrors: (
    errors:
      | Record<string, string>
      | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
}

/**
 * Orchestrates the literature-review step: loads existing data or runs the review pipeline.
 *
 * @returns The literature review state and control helpers.
 */
export function useLiteratureReview(): UseLiteratureReviewResult {
  const { finalizeLiterature } = useLiteratureContinue();
  const queryClient = useQueryClient();

  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const hasTriggeredRef = useRef(false);
  const [boxErrors, setBoxErrors] = useState<Record<string, string>>({});
  const [allProcessed, setAllProcessed] = useState(false);

  const { data: allBoxes, isLoading: boxesLoading } = useQuery({
    queryKey: ["boxes-full"],
    queryFn: fetchBoxesWithFullShape,
  });

  const { data: initialPool, isLoading: poolLoading } = useQuery({
    queryKey: ["literature-pool"],
    queryFn: async () => {
      const res = await fetchPreloadedLiteraturePool();
      return res.data ?? [];
    },
  });

  const subBoxes = useMemo(() => {
    if (!allBoxes) return [];
    return [...allBoxes].sort((a, b) => compareBoxTypes(a.boxType, b.boxType));
  }, [allBoxes]);

  const loading = boxesLoading || poolLoading || allBoxes === undefined;

  const literaturePool = useMemo(() => {
    return initialPool
      ? (JSON.parse(JSON.stringify(initialPool)) as LiteraturePoolEntry[])
      : [];
  }, [initialPool]);

  const archivalBoxes = useMemo(() => {
    const archivalSet = new Set<string>();
    for (const box of subBoxes) {
      if (box.boxType === "PRIMARY_MATERIAL") {
        archivalSet.add(box.title);
      }
    }
    return archivalSet;
  }, [subBoxes]);

  const boxStatuses = useMemo(() => {
    const statuses: Record<string, BoxStatus> = {};
    for (const box of subBoxes) {
      const poolEntry = literaturePool.find(
        (entry) => entry.subBoxTitle === box.title,
      );
      if (
        poolEntry?.status === "manual_entry_required" ||
        box.boxType === "PRIMARY_MATERIAL"
      ) {
        statuses[box.title] = "manual_entry_required";
        continue;
      }
      const hasEntry = literaturePool.some(
        (entry) => entry.subBoxTitle === box.title && entry.articles.length > 0,
      );
      if (hasEntry) {
        statuses[box.title] = "done";
      } else if (processing) {
        statuses[box.title] = "loading";
      } else {
        statuses[box.title] = "idle";
      }
    }
    return statuses;
  }, [subBoxes, literaturePool, processing]);

  const runPipeline = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const freshBoxes = await fetchUncachedBoxesWithFullShape();
      const targetBoxes = (
        freshBoxes.length > 0 ? freshBoxes : subBoxes
      ).filter((box) => box.boxType !== "RELATED_THESES");
      const subBoxInputs: SubBoxInput[] = targetBoxes.map((box) => ({
        id: box.id ?? 0,
        title: box.title,
        description: box.description,
        boxType: box.boxType,
        subBoxes: (box.subBoxes ?? []).map((sb) => ({
          title: sb.title,
          description: sb.description,
          thesisBoxId: sb.id ?? 0,
          semanticQuery: sb.semanticQuery ?? "",
        })),
      }));

      const res = await runLiteraturePipelineAction(subBoxInputs);
      if (res.data) {
        queryClient.invalidateQueries({ queryKey: ["literature-pool"] });
        queryClient.setQueryData(["literature-pool"], res.data);
      } else if (res.error) {
        handleActionErrorToast(
          res as unknown as Parameters<typeof handleActionErrorToast>[0],
          `Literatür taraması hatası: ${res.error}`,
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Tarama çalıştırılamadı.";
      handleActionErrorToast(msg);
    } finally {
      setProcessing(false);
    }
  }, [processing, subBoxes, queryClient]);

  const retryReview = useCallback(async () => {
    hasTriggeredRef.current = true;
    await runPipeline();
  }, [runPipeline]);

  const handleFinalize = useCallback(async () => {
    setAllProcessed(true);

    if (literaturePool.length === 0) return;

    setConfirming(true);

    const result = await finalizeLiterature();
    setConfirming(false);

    if ("error" in result && result.error) return;
  }, [literaturePool, finalizeLiterature]);

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
    handleFinalize,
    retryReview,
    setProcessing,
    setBoxErrors,
  };
}
