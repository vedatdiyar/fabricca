"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { LoadingStep } from "@/lib/store/onboarding-store";
import type {
  GeminiThesisBox,
  LiteraturePoolEntry,
  JuryArticle,
} from "@/lib/types";
import { processAllBoxesAction, confirmLiteratureAction } from "../actions";
import { fetchBoxesWithFullShape } from "../../_lib/fetch-actions";
import { clearDownstreamDbAction } from "@/app/(auth)/onboarding/actions";

const boxOrderWeight: Record<string, number> = {
  CONCEPTUAL: 1,
  PROBLEMATIZATION: 2,
  DATA_PROTOCOL: 3,
  RELATED_THESES: 4,
  PRIMARY_MATERIAL: 5,
};

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
  const finalizedRef = useRef(false);
  const processingRef = useRef(false);

  const [phase, setPhase] = useState({
    loading: true,
    processing: false,
    confirming: false,
  });
  const [hasAttempted, setHasAttempted] = useState(false);
  const [subBoxes, setSubBoxes] = useState<GeminiThesisBox[]>([]);
  const [boxResults, setBoxResults] = useState<{
    statuses: Record<string, BoxStatus>;
    errors: Record<string, string>;
  }>({ statuses: {}, errors: {} });
  const [archivalBoxes, setArchivalBoxes] = useState<Set<string>>(new Set());

  const cachedPapers = useOnboardingStore((s) => s.cachedPapers);
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

  // Load boxes on mount. The DB is the single source of truth — Zustand boxes
  // are never consulted. If the server-side title set changed (e.g. user went
  // back and regenerated boxes), the stale literature pool is flushed.
  useEffect(() => {
    finalizedRef.current = false;
    let cancelled = false;
    fetchBoxesWithFullShape().then((allBoxes) => {
      if (cancelled) return;

      const freshTitles = new Set(allBoxes.map((b) => b.title));
      const poolTitles = new Set(
        useOnboardingStore.getState().literaturePool.map((e) => e.subBoxTitle),
      );
      const titlesMatch =
        freshTitles.size === poolTitles.size &&
        [...freshTitles].every((t) => poolTitles.has(t));

      if (!titlesMatch) {
        useOnboardingStore.getState().setLiteraturePool([]);
      }

      // If the pool is populated but the literature-review step is not
      // marked complete, the data is stale (e.g. restored from sessionStorage
      // after a code change at a previous stage). Clear it so the pipeline
      // re-runs instead of showing stale cache.
      const steps = useOnboardingStore.getState().stepsCompleted;
      const pool = useOnboardingStore.getState().literaturePool;
      if (pool.length > 0 && !steps["literature-review"]) {
        useOnboardingStore.getState().setLiteraturePool([]);
      }

      setSubBoxes(
        [...allBoxes].sort((a, b) => {
          const weightA = boxOrderWeight[a.boxType] ?? 99;
          const weightB = boxOrderWeight[b.boxType] ?? 99;
          return weightA - weightB;
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

    setHasAttempted(true);
    processingRef.current = true;
    setPhase((prev) => ({ ...prev, processing: true }));

    const isArchival = (box: GeminiThesisBox): boolean =>
      box.boxType === "PRIMARY_MATERIAL" || box.boxType === "RELATED_THESES";

    const allSteps: LoadingStep[] = subBoxes.map((box) => ({
      text: `${box.title} taranıyor...`,
      status: "idle" as const,
    }));

    let isCancelled = false;

    showLoading(
      "Literatür Taraması Devam Ediyor",
      "Tüm konu kutuları için akademik veri tabanları taranıyor, yapay zeka değerlendirmesi yapılıyor.",
      allSteps,
      () => {
        isCancelled = true;
        processingRef.current = false;
        setPhase((prev) => ({ ...prev, processing: false }));
        // Clears literature-review step completion and literaturePool
        useOnboardingStore.getState().clearDownstreamData("boxes");
        useOnboardingStore.getState().unsetStepCompleted("boxes");
        useOnboardingStore.getState().unsetStepCompleted("literature-review");
        void clearDownstreamDbAction("boxes");
        toast.info("İşlem iptal edildi, önceki adıma yönlendiriliyorsunuz.");
        router.push("/onboarding/boxes");
        // Reset box statuses to idle when cancelled so we don't show loading skeletons forever
        setBoxResults((prev) => {
          const resetStatuses = { ...prev.statuses };
          subBoxes.forEach((box) => {
            resetStatuses[box.title] = "idle";
          });
          return {
            ...prev,
            statuses: resetStatuses,
          };
        });
      },
    );

    // Mark all steps as active
    for (let i = 0; i < subBoxes.length; i++) {
      if (isCancelled) return;
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
        subBoxes: (box.subBoxes ?? []).map((sb) => ({
          title: sb.title,
          semanticQuery: sb.semanticQuery ?? "",
          foundationalQueries: sb.foundationalQueries ?? [],
        })),
        foundationalQueries: (box.subBoxes ?? []).flatMap(
          (sb) => sb.foundationalQueries ?? [],
        ),
      })),
      cachedPapers,
    );

    if (isCancelled) return;

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
      useOnboardingStore.getState().setStepCompleted("boxes");

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
  }, [
    subBoxes,
    cachedPapers,
    showLoading,
    hideLoading,
    updateLoadingStep,
    router,
  ]);

  /**
   * Adds a manually-entered archive entry for an archival/empirical box.
   * Converts the user input into a JuryArticle so it flows through the
   * standard confirmLiteratureAction pipeline unchanged.
   */
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

      addToLiteraturePool({
        subBoxTitle,
        articles: [archiveArticle],
      });
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

      finalizedRef.current = true;
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
    if (finalizedRef.current) return;
    if (subBoxes.length === 0) return;
    if (hasAttempted) return;

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
    hasAttempted,
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
