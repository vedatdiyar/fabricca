"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { LoadingStep } from "@/lib/store/onboarding-store";
import type { GeminiThesisBox, LiteraturePoolEntry } from "@/lib/types";
import {
  processLiteratureReviewAction,
  confirmLiteratureAction,
} from "../actions";
import { fetchBoxes } from "../../_lib/fetch-actions";

/** Processing status of a single sub-box within the literature review grid. */
export type BoxStatus = "idle" | "loading" | "done" | "error";

/** Chunk size for parallel literature-review processing. */
const CHUNK_SIZE = 2;

/** Shape returned by {@link useLiteratureReview}. */
export interface UseLiteratureReviewResult {
  /** The sub-boxes to render (merged DB boxes + Zustand foundational queries). */
  subBoxes: GeminiThesisBox[];
  /** True while the boxes are being loaded on mount. */
  loading: boolean;
  /** True while the parallel review pipeline is running. */
  processing: boolean;
  /** True while the finalize (confirm) flow is writing to the database. */
  confirming: boolean;
  /** Per-box processing status keyed by box title. */
  boxStatuses: Record<string, BoxStatus>;
  /** Per-box error messages keyed by box title. */
  boxErrors: Record<string, string>;
  /** True when every sub-box has a corresponding literature-pool entry. */
  allProcessed: boolean;
  /** The current literature pool (starter + reserved packs). */
  literaturePool: LiteraturePoolEntry[];
  /** Starts the chunked parallel literature-review pipeline. */
  startReviewProcess: () => Promise<void>;
  /** Finalizes onboarding: persists the pool, resets the store, navigates. */
  handleFinalize: () => Promise<void>;
}

/**
 * Encapsulates the literature-review step orchestration: loading the sub-boxes,
 * running the chunked parallel review pipeline (with per-box status and loading
 * overlay bookkeeping), and finalizing onboarding (DB write → store reset →
 * dashboard navigation). The consuming component renders only the returned
 * state.
 *
 * @returns Literature-review state plus the two orchestration callbacks.
 */
export function useLiteratureReview(): UseLiteratureReviewResult {
  const router = useRouter();
  const [subBoxes, setSubBoxes] = useState<GeminiThesisBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const hasAutoTriggeredRef = useRef(false);
  const [boxStatuses, setBoxStatuses] = useState<Record<string, BoxStatus>>({});
  const [boxErrors, setBoxErrors] = useState<Record<string, string>>({});

  const rawLiteraturePool = useOnboardingStore((s) => s.literaturePool);
  const literaturePool = useMemo(
    () => rawLiteraturePool ?? [],
    [rawLiteraturePool],
  );
  const addToLiteraturePool = useOnboardingStore((s) => s.addToLiteraturePool);
  const resetStore = useOnboardingStore((s) => s.resetStore);
  const showLoading = useOnboardingStore((s) => s.showLoading);
  const hideLoading = useOnboardingStore((s) => s.hideLoading);
  const updateLoadingStep = useOnboardingStore((s) => s.updateLoadingStep);

  // Load boxes on mount and reconcile them against the persisted literature pool.
  useEffect(() => {
    let cancelled = false;
    fetchBoxes().then((allBoxes) => {
      if (cancelled) return;
      // With flat hierarchy, all boxes are direct items
      const freshTitles = new Set(allBoxes.map((b) => b.title));
      const currentStore = useOnboardingStore.getState();
      const poolTitles = new Set(
        currentStore.literaturePool.map((e) => e.subBoxTitle),
      );

      // 1. Title-level reconciliation — if the set of titles changed, flush.
      const titlesMatch =
        freshTitles.size === poolTitles.size &&
        [...freshTitles].every((t) => poolTitles.has(t));

      // 2. Content-level reconciliation — even with matching titles the box
      //    content (description / semanticSearchBlock) may have been updated
      //    server-side or via a handleProceed → setBoxes cycle.  Compare
      //    every live DB box against its counterpart in the Zustand store.
      let contentChanged = false;
      if (titlesMatch) {
        const freshBoxMap = new Map(allBoxes.map((b) => [b.title, b]));
        const storeBoxMap = new Map(
          (currentStore.boxes ?? []).map((b) => [b.title, b]),
        );
        contentChanged = [...freshTitles].some((title) => {
          const fresh = freshBoxMap.get(title);
          const stored = storeBoxMap.get(title);
          if (!fresh || !stored) return false;
          return (
            (fresh.description ?? "") !== (stored.description ?? "") ||
            (fresh.semanticSearchBlock ?? "") !==
              (stored.semanticSearchBlock ?? "")
          );
        });
      }

      if (!titlesMatch || contentChanged) {
        useOnboardingStore.getState().setLiteraturePool([]);
      }
      // Merge foundationalQueries from Zustand store (if exists) into DB boxes
      const storeBoxMap = new Map(
        (currentStore.boxes ?? []).map((b) => [b.title, b.foundationalQueries]),
      );
      setSubBoxes(
        allBoxes.map((b) => ({
          title: b.title,
          description: b.description ?? "",
          semanticSearchBlock: b.semanticSearchBlock ?? "",
          foundationalQueries: storeBoxMap.get(b.title) ?? [],
          concepts: b.concepts ?? [],
        })),
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // router intentionally excluded — redirect on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Runs the literature-review pipeline over all sub-boxes in fixed-size chunks
   * (see {@link CHUNK_SIZE}). Each chunk is processed in parallel via the bulk
   * server action; results are streamed into the Zustand pool and the global
   * loading overlay is advanced step-by-step.
   */
  const startReviewProcess = useCallback(async () => {
    if (subBoxes.length === 0 || processingRef.current) return;

    processingRef.current = true;
    setProcessing(true);

    const reviewSteps: LoadingStep[] = subBoxes.map((box) => ({
      text: `${box.title} taranıyor...`,
      status: "idle" as const,
    }));

    showLoading(
      "Literatür Taraması Devam Ediyor",
      "Her bir konu kutusu için akademik veri tabanları taranıyor, yapay zeka değerlendirmesi yapılıyor.",
      reviewSteps,
    );

    let globalStepIndex = 0;

    for (let i = 0; i < subBoxes.length; i += CHUNK_SIZE) {
      const chunk = subBoxes.slice(i, i + CHUNK_SIZE);

      // Mark both chunk steps as active
      for (let k = 0; k < chunk.length; k++) {
        updateLoadingStep(globalStepIndex + k, "active");
      }

      setBoxStatuses((prev) => {
        const next = { ...prev };
        for (const box of chunk) next[box.title] = "loading";
        return next;
      });

      const bulkResult = await processLiteratureReviewAction(
        chunk.map((box) => ({
          title: box.title,
          description: box.description,
          semanticSearchBlock: box.semanticSearchBlock,
          foundationalQueries: box.foundationalQueries,
        })),
      );

      if (bulkResult.data) {
        for (let j = 0; j < chunk.length; j++) {
          const box = chunk[j];
          const boxResult = bulkResult.data[j];
          addToLiteraturePool({
            subBoxTitle: box.title,
            starterPack: boxResult.starterPack,
            reservedPool: boxResult.reservedPool,
          });
          setBoxStatuses((prev) => ({ ...prev, [box.title]: "done" }));
          updateLoadingStep(globalStepIndex + j, "completed");
        }
      } else {
        const msg = bulkResult.error ?? "Literatür taraması başarısız oldu.";
        for (let j = 0; j < chunk.length; j++) {
          const box = chunk[j];
          setBoxErrors((prev) => ({ ...prev, [box.title]: msg }));
          setBoxStatuses((prev) => ({ ...prev, [box.title]: "error" }));
          updateLoadingStep(globalStepIndex + j, "completed");
        }
      }

      globalStepIndex += chunk.length;
    }

    processingRef.current = false;
    setProcessing(false);
    hideLoading();
  }, [
    subBoxes,
    addToLiteraturePool,
    showLoading,
    hideLoading,
    updateLoadingStep,
  ]);

  const allProcessed = useMemo(() => {
    if (subBoxes.length === 0) return false;
    return subBoxes.every((box) =>
      literaturePool.some((entry) => entry.subBoxTitle === box.title),
    );
  }, [subBoxes, literaturePool]);

  /**
   * Finalizes the onboarding flow: persists the literature pool to the database
   * via {@link confirmLiteratureAction}, resets the transient Zustand store,
   * notifies the user and navigates to the dashboard.
   */
  const handleFinalize = useCallback(async () => {
    if (literaturePool.length === 0) {
      toast.error("Henüz işlenmiş literatür verisi bulunamadı.");
      return;
    }

    setConfirming(true);

    try {
      const result = await confirmLiteratureAction({ literaturePool });
      if ("error" in result && result.error) {
        toast.error(result.error);
        setConfirming(false);
        return;
      }

      useOnboardingStore.getState().setEnrichmentPool([]);
      resetStore();
      setConfirming(false);
      toast.success("Tebrikler! Onboarding süreciniz tamamlandı.");
      router.push("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
      setConfirming(false);
    }
  }, [literaturePool, resetStore, router]);

  // Auto-trigger review process when boxes load and pool is empty.
  useEffect(() => {
    if (loading || processing || hasAutoTriggeredRef.current) return;
    if (subBoxes.length > 0 && !allProcessed) {
      hasAutoTriggeredRef.current = true;
      startReviewProcess();
    }
  }, [loading, processing, subBoxes, allProcessed, startReviewProcess]);

  return {
    subBoxes,
    loading,
    processing,
    confirming,
    boxStatuses,
    boxErrors,
    allProcessed,
    literaturePool,
    startReviewProcess,
    handleFinalize,
  };
}
