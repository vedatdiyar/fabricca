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
import { processAllBoxesAction, confirmLiteratureAction } from "../actions";
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
  const [phase, setPhase] = useState({
    loading: true,
    processing: false,
    confirming: false,
  });
  const processingRef = useRef(false);
  const [boxResults, setBoxResults] = useState<{
    statuses: Record<string, BoxStatus>;
    errors: Record<string, string>;
  }>({ statuses: {}, errors: {} });
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
      //    content (description / semanticSearchQueries) may have been updated
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
            (fresh.semanticSearchQueries ?? []).join("|||") !==
              (stored.semanticSearchQueries ?? []).join("|||")
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
              "PROBLEMATIZATION",
            description: b.description ?? "",
            semanticSearchQueries: b.semanticSearchQueries ?? [],
            foundationalQueries:
              stored?.foundationalQueries ?? b.foundationalQueries ?? [],
            concepts: b.concepts ?? [],
          };
        }),
      );
      setPhase((prev) => ({ ...prev, loading: false }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Runs the literature-review pipeline over all sub-boxes in a single
   * batch server action. The server handles OpenAlex searches (rate-limited
   * sequentially), global cross-box deduplication, Gemini academic review,
   * and Crossref enrichment — all before returning the full result set.
   * The loading overlay reports progress via steps.
   */
  const startReviewProcess = useCallback(async () => {
    if (subBoxes.length === 0 || processingRef.current) return;

    processingRef.current = true;
    setPhase((prev) => ({ ...prev, processing: true }));

    const isArchival = (box: GeminiThesisBox): boolean => {
      if (!box.foundationalQueries || box.foundationalQueries.length === 0) {
        return false;
      }
      const first = box.foundationalQueries[0];
      return (
        first.author === "Primary Source Repository" ||
        first.publicationYear === 0
      );
    };

    const allSteps: LoadingStep[] = subBoxes.map((box) => ({
      text: `${box.title} taranıyor...`,
      status: "idle" as const,
    }));

    showLoading(
      "Literatür Taraması Devam Ediyor",
      "Tüm konu kutuları için akademik veri tabanları taranıyor, yapay zeka değerlendirmesi yapılıyor.",
      allSteps,
    );

    // Mark all steps as active
    for (let i = 0; i < subBoxes.length; i++) {
      updateLoadingStep(i, "active");
      setBoxResults((prev) => ({
        ...prev,
        statuses: { ...prev.statuses, [subBoxes[i].title]: "loading" },
      }));
    }

    const result = await processAllBoxesAction(
      subBoxes.map((box) => ({
        title: box.title,
        description: box.description,
        boxType: box.boxType,
        semanticSearchQueries: box.semanticSearchQueries,
        foundationalQueries: box.foundationalQueries,
      })),
    );

    if (result.data) {
      // Collect archival box titles from the result
      const archivalSet = new Set<string>();

      for (const entry of result.data) {
        const box = subBoxes.find((b) => b.title === entry.subBoxTitle);
        if (box && isArchival(box)) {
          archivalSet.add(entry.subBoxTitle);
        }
      }
      setArchivalBoxes(archivalSet);

      // Set the entire pool at once
      useOnboardingStore.getState().setLiteraturePool(result.data);

      // Mark all boxes as done
      for (let i = 0; i < subBoxes.length; i++) {
        setBoxResults((prev) => ({
          ...prev,
          statuses: { ...prev.statuses, [subBoxes[i].title]: "done" },
        }));
        updateLoadingStep(i, "completed");
      }
    } else {
      const errorMsg =
        result.error ?? "Literatür taraması sırasında bir hata oluştu.";

      for (let i = 0; i < subBoxes.length; i++) {
        setBoxResults((prev) => ({
          ...prev,
          errors: { ...prev.errors, [subBoxes[i].title]: errorMsg },
          statuses: { ...prev.statuses, [subBoxes[i].title]: "error" },
        }));
        updateLoadingStep(i, "completed");
      }
    }

    processingRef.current = false;
    setPhase((prev) => ({ ...prev, processing: false }));
    hideLoading();
  }, [subBoxes, showLoading, hideLoading, updateLoadingStep]);

  /**
   * Adds a manually-entered archive entry for an archival/empirical box.
   * Converts the user input into a JuryArticle so it flows through the
   * standard confirmLiteratureAction pipeline unchanged.
   */
  const addArchiveEntry = useCallback(
    (subBoxTitle: string, entry: { title: string; description?: string }) => {
      const archiveArticle: JuryArticle = {
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
        relevanceScore: 100,
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
        return entry !== undefined;
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

    setPhase((prev) => ({ ...prev, confirming: true }));

    try {
      const result = await confirmLiteratureAction({ literaturePool });
      if ("error" in result && result.error) {
        toast.error(result.error);
        setPhase((prev) => ({ ...prev, confirming: false }));
        return;
      }

      resetStore();
      setPhase((prev) => ({ ...prev, confirming: false }));
      toast.success("Tebrikler! Onboarding süreciniz tamamlandı.");
      router.push("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
      setPhase((prev) => ({ ...prev, confirming: false }));
    }
  }, [literaturePool, resetStore, router]);

  // Auto-trigger review process when boxes load and pool is empty.
  // Uses state-based guards (loading, processing, literaturePool) instead of a
  // ref to remain correct under React Strict Mode (double-mount).
  useEffect(() => {
    if (phase.loading) return;
    if (phase.processing) return;
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
      Promise.resolve().then(() => startReviewProcess());
    }
  }, [
    phase.loading,
    phase.processing,
    subBoxes,
    literaturePool,
    startReviewProcess,
  ]);

  return {
    subBoxes,
    loading: phase.loading,
    processing: phase.processing,
    confirming: phase.confirming,
    boxStatuses: boxResults.statuses,
    boxErrors: boxResults.errors,
    allProcessed,
    literaturePool,
    archivalBoxes,
    addArchiveEntry,
    startReviewProcess,
    handleFinalize,
  };
}
