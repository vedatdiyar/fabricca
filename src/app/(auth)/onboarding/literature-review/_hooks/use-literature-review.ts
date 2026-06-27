"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLoadingOverlay } from "@/components/providers/loading-overlay-provider";
import type { LoadingStep } from "@/components/providers/loading-overlay-provider";
import type {
  GeminiThesisBox,
  LiteraturePoolEntry,
  JuryArticle,
} from "@/lib/types";
import { processAllBoxesAction, confirmLiteratureAction } from "../actions";
import { fetchBoxesWithFullShape } from "../../_lib/fetch-actions";
import { clearDownstreamDbAction } from "@/app/(auth)/onboarding/actions";

const boxOrderWeight: Record<string, number> = {
  PROBLEMATIZATION: 1,
  CONCEPTUAL: 2,
  DATA_PROTOCOL: 3,
  PRIMARY_MATERIAL: 4,
  RELATED_THESES: 5,
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
  startReviewProcess: () => Promise<void>;
  handleFinalize: () => Promise<void>;
}

/**
 * Encapsulates the literature-review step orchestration: loading the sub-boxes
 * via TanStack Query, running the sequential review pipeline, and finalizing
 * onboarding. The literature pool is held in local state (no global store).
 *
 * @returns Literature-review state plus the two orchestration callbacks.
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

  const { showLoading, hideLoading, updateLoadingStep } = useLoadingOverlay();

  // Fetch boxes from DB via TanStack Query
  const {
    data: allBoxes,
    isLoading: boxesLoading,
  } = useQuery({
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

  // Derive cached papers from TanStack Query cache (set by prefetch in proceedFromRisk)
  const cachedPapers = queryClient.getQueryData<Record<string, never>>([
    "cachedPapers",
  ]);

  const startReviewProcess = useCallback(async () => {
    if (subBoxes.length === 0 || processing) return;

    setProcessing(true);

    // If the box titles changed since the pool was built, clear the stale pool
    const poolTitles = new Set(literaturePool.map((e) => e.subBoxTitle));
    const freshTitles = new Set(subBoxes.map((b) => b.title));
    const titlesMatch =
      freshTitles.size === poolTitles.size &&
      [...freshTitles].every((t) => poolTitles.has(t));
    if (!titlesMatch && literaturePool.length > 0) {
      setLiteraturePool([]);
    }

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
        setProcessing(false);
        setLiteraturePool([]);
        void clearDownstreamDbAction("boxes").then(() => {
          queryClient.invalidateQueries();
        });
        toast.info("İşlem iptal edildi, önceki adıma yönlendiriliyorsunuz.");
        router.push("/onboarding/boxes");
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
      cachedPapers as Record<string, never> | undefined,
    );

    if (isCancelled) return;

    if (result.data) {
      const archivalSet = new Set<string>();

      for (const entry of result.data) {
        const box = subBoxes.find((b) => b.title === entry.subBoxTitle);
        if (box && isArchival(box)) {
          archivalSet.add(entry.subBoxTitle);
        }
      }
      setArchivalBoxes(archivalSet);

      setLiteraturePool(result.data);

      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });

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

    setProcessing(false);
    hideLoading();
  }, [
    subBoxes,
    literaturePool,
    processing,
    cachedPapers,
    showLoading,
    hideLoading,
    updateLoadingStep,
    queryClient,
    router,
  ]);

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
      const result = await confirmLiteratureAction({ literaturePool });
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
  }, [literaturePool, queryClient, router]);

  // Auto-trigger review process when boxes load and pool is empty.
  // Relies on the `processing` state as the guard — once set, further
  // invocations of this effect are blocked until processing completes.
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
      Promise.resolve().then(() => startReviewProcess());
    }
  }, [
    loading,
    processing,
    subBoxes,
    literaturePool,
    startReviewProcess,
  ]);

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
    startReviewProcess,
    handleFinalize,
  };
}
