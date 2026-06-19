"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { formatAcademicTitle } from "@/lib/utils/academic-formatter";
import type { LoadingStep } from "@/lib/store/onboarding-store";
import type {
  GeminiThesisBox,
  LiteraturePoolEntry,
  JuryArticle,
} from "@/lib/types";
import {
  processLiteratureReviewAction,
  confirmLiteratureAction,
} from "../actions";
import { fetchBoxes } from "../../_lib/fetch-actions";

/** Processing status of a single sub-box within the literature review grid. */
export type BoxStatus = "idle" | "loading" | "done" | "error";

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
  /** True when every sub-box has a corresponding literature-pool entry (or manual entries for archival boxes). */
  allProcessed: boolean;
  /** The current literature pool (starter + reserved packs). */
  literaturePool: LiteraturePoolEntry[];
  /** Set of sub-box titles that bypassed external APIs (archival/empirical). */
  archivalBoxes: Set<string>;
  /** Adds a manually-entered archive entry to the literature pool for an archival box. */
  addArchiveEntry: (
    subBoxTitle: string,
    entry: { title: string; description?: string },
  ) => void;
  /** Starts the sequential literature-review pipeline (one box at a time). */
  startReviewProcess: () => Promise<void>;
  /** Finalizes onboarding: persists the pool, resets the store, navigates. */
  handleFinalize: () => Promise<void>;
}

/**
 * Encapsulates the literature-review step orchestration: loading the sub-boxes,
 * running the sequential review pipeline (each box sent one at a time so the
 * UI can update per-box progress in real time), and finalizing onboarding
 * (DB write -> store reset -> dashboard navigation). The consuming component
 * renders only the returned state.
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
  const [boxStatuses, setBoxStatuses] = useState<Record<string, BoxStatus>>({});
  const [boxErrors, setBoxErrors] = useState<Record<string, string>>({});
  const [archivalBoxes, setArchivalBoxes] = useState<Set<string>>(new Set());

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
      //    server-side or via a handleProceed -> setBoxes cycle.  Compare
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
      // Merge Zustand store boxes into DB boxes for the full GeminiThesisBox
      // shape (boxType, foundationalQueries). Fall back to DB stored values
      // when Zustand is empty so that data is never silently dropped on
      // page refresh.
      const storeBoxMap = new Map(
        (currentStore.boxes ?? []).map((b) => [b.title, b]),
      );
      setSubBoxes(
        allBoxes.map((b) => {
          const stored = storeBoxMap.get(b.title);
          return {
            title: b.title,
            boxType:
              stored?.boxType ??
              (b.boxType as GeminiThesisBox["boxType"]) ??
              "Kuram",
            description: b.description ?? "",
            semanticSearchBlock: b.semanticSearchBlock ?? "",
            foundationalQueries:
              stored?.foundationalQueries ?? b.foundationalQueries ?? [],
            concepts: b.concepts ?? [],
          };
        }),
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Runs the literature-review pipeline over all sub-boxes sequentially.
   * Each sub-box is sent to the server one at a time; as soon as a box is
   * done its result is written to the Zustand store and the UI is updated
   * so the user can watch progress in real time. A 500 ms throttle between
   * boxes prevents 429 rate-limit errors from OpenAlex.
   */
  const startReviewProcess = useCallback(async () => {
    if (subBoxes.length === 0 || processingRef.current) return;

    processingRef.current = true;
    setProcessing(true);

    // All steps start as "idle"; each will transition to "active" then
    // "completed" as it is processed sequentially.
    const reviewSteps: LoadingStep[] = subBoxes.map((box) => ({
      text: `${box.title} taranıyor...`,
      status: "idle" as const,
    }));

    showLoading(
      "Literatür Taraması Devam Ediyor",
      "Her bir konu kutusu için akademik veri tabanları taranıyor, yapay zeka değerlendirmesi yapılıyor.",
      reviewSteps,
    );

    for (let i = 0; i < subBoxes.length; i++) {
      const box = subBoxes[i];

      updateLoadingStep(i, "active");
      setBoxStatuses((prev) => ({ ...prev, [box.title]: "loading" }));

      const result = await processLiteratureReviewAction({
        title: box.title,
        description: box.description,
        boxType: box.boxType,
        semanticSearchBlock: box.semanticSearchBlock,
        foundationalQueries: box.foundationalQueries,
      });

      if (result.data) {
        if (result.data.isArchivalBypass) {
          setArchivalBoxes((prev) => new Set(prev).add(box.title));
        } else {
          addToLiteraturePool({
            subBoxTitle: box.title,
            starterPack: result.data.starterPack,
            reservedPool: result.data.reservedPool,
          });
        }

        setBoxStatuses((prev) => ({ ...prev, [box.title]: "done" }));
        updateLoadingStep(i, "completed");
      } else {
        const msg = result.error ?? "Kutu işlenirken hata oluştu.";
        setBoxErrors((prev) => ({ ...prev, [box.title]: msg }));
        setBoxStatuses((prev) => ({ ...prev, [box.title]: "error" }));
        updateLoadingStep(i, "completed");
      }

      // Throttle between boxes to avoid 429 rate-limit errors
      if (i < subBoxes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
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

  /**
   * Adds a manually-entered archive entry for an archival/empirical box.
   * Converts the user input into a JuryArticle with type: "PRIMARY" so it
   * flows through the standard confirmLiteratureAction pipeline unchanged.
   */
  const addArchiveEntry = useCallback(
    (subBoxTitle: string, entry: { title: string; description?: string }) => {
      const archiveArticle: JuryArticle = {
        type: "PRIMARY",
        title: formatAcademicTitle(entry.title),
        abstract:
          entry.description ??
          "Birincil arşiv belgesi — kullanıcı tarafından el ile girilmiştir.",
        url: "",
        doi: "",
        publisher: "",
        publicationYear: 0,
        authors: [],
        isFoundational: true,
      };

      const existingEntry = useOnboardingStore
        .getState()
        .literaturePool.find((e) => e.subBoxTitle === subBoxTitle);

      if (existingEntry) {
        const updatedPool = useOnboardingStore
          .getState()
          .literaturePool.map((e) =>
            e.subBoxTitle === subBoxTitle
              ? { ...e, starterPack: [...e.starterPack, archiveArticle] }
              : e,
          );
        useOnboardingStore.getState().setLiteraturePool(updatedPool);
      } else {
        addToLiteraturePool({
          subBoxTitle,
          starterPack: [archiveArticle],
          reservedPool: [],
        });
      }
    },
    [addToLiteraturePool],
  );

  const allProcessed = useMemo(() => {
    if (subBoxes.length === 0) return false;
    return subBoxes.every((box) => {
      if (archivalBoxes.has(box.title)) {
        const entry = literaturePool.find((e) => e.subBoxTitle === box.title);
        return entry !== undefined && entry.starterPack.length > 0;
      }
      return literaturePool.some((entry) => entry.subBoxTitle === box.title);
    });
  }, [subBoxes, literaturePool, archivalBoxes]);

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
  // Uses state-based guards (loading, processing, literaturePool) instead of a
  // ref to remain correct under React Strict Mode (double-mount).
  useEffect(() => {
    if (loading) return;
    if (processing) return;
    if (subBoxes.length === 0) return;

    const allDone = subBoxes.every((box) =>
      literaturePool.some((entry) => entry.subBoxTitle === box.title),
    );

    if (!allDone) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "[literature] auto-trigger: starting review for",
          subBoxes.length,
          "boxes, pool size:",
          literaturePool.length,
        );
      }
      startReviewProcess();
    }
  }, [loading, processing, subBoxes, literaturePool, startReviewProcess]);

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
    startReviewProcess,
    handleFinalize,
  };
}
