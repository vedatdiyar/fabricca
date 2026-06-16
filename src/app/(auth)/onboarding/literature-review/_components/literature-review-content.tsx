"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  AlertCircle,
  BookOpen,
  Library,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  processLiteratureReviewAction,
  confirmLiteratureAction,
} from "../actions";
import { fetchBoxes } from "../../lib/fetch-actions";
import { LiteratureArticleCard } from "./literature-article-card";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { LoadingStep } from "@/lib/store/onboarding-store";
import type { GeminiThesisBox, LiteraturePoolEntry } from "@/lib/types";
import type { LiteratureReviewResult } from "../_services/ai-processor";

function SubBoxQuery({
  subBox,
  status,
  errorMessage,
}: {
  subBox: GeminiThesisBox;
  status: "idle" | "loading" | "done" | "error";
  errorMessage?: string;
}) {
  const literaturePool = useOnboardingStore((s) => s.literaturePool);

  if (status === "idle") return null;

  if (status === "loading") {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 w-3/4 rounded bg-border" />
        <div className="h-24 w-full rounded-lg bg-border/60" />
        <div className="h-24 w-full rounded-lg bg-border/60" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-6 text-center border border-destructive/30 rounded-lg bg-destructive/5">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-destructive font-medium mb-1">
          Tarama hatası
        </p>
        <p className="text-xs text-muted-foreground mb-3">{errorMessage}</p>
      </div>
    );
  }

  const entry = literaturePool.find((e) => e.subBoxTitle === subBox.title);
  if (!entry || entry.starterPack.length === 0) {
    return (
      <div className="p-6 text-center border border-dashed border-border rounded-lg bg-card/20">
        <p className="text-sm text-muted-foreground">Kaynak bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {entry.starterPack.map((article, idx) => (
          <LiteratureArticleCard key={idx} article={article} />
        ))}
      </div>
      {entry.reservedPool.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/30">
          <Library className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {entry.reservedPool.length}
            </span>{" "}
            ek kaynak daha önerildi.
          </p>
        </div>
      )}
    </div>
  );
}

type BoxStatus = "idle" | "loading" | "done" | "error";

export function LiteratureReviewContent() {
  const router = useRouter();
  const [subBoxes, setSubBoxes] = useState<GeminiThesisBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const [boxStatuses, setBoxStatuses] = useState<Record<string, BoxStatus>>({});
  const [boxErrors, setBoxErrors] = useState<Record<string, string>>({});
  const store = useOnboardingStore();
  const literaturePool = store.literaturePool ?? [];
  const addToLiteraturePool = store.addToLiteraturePool;
  const resetStore = store.resetStore;
  const showLoading = store.showLoading;
  const hideLoading = store.hideLoading;
  const updateLoadingStep = store.updateLoadingStep;

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
      // If the set of sub-boxes doesn't match literaturePool, reset the pool
      if (
        freshTitles.size !== poolTitles.size ||
        ![...freshTitles].every((t) => poolTitles.has(t))
      ) {
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
    return () => { cancelled = true; };
  }, []);

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

    const CHUNK_SIZE = 2;
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

      const results = await Promise.allSettled(
        chunk.map((box) =>
          processLiteratureReviewAction({
            title: box.title,
            description: box.description,
            semanticSearchBlock: box.semanticSearchBlock,
            foundationalQueries: box.foundationalQueries,
          }),
        ),
      );

      for (let j = 0; j < chunk.length; j++) {
        const box = chunk[j];
        const settled = results[j];

        if (settled.status === "fulfilled" && settled.value.data) {
          addToLiteraturePool({
            subBoxTitle: box.title,
            starterPack: settled.value.data.starterPack,
            reservedPool: settled.value.data.reservedPool,
          });
          setBoxStatuses((prev) => ({ ...prev, [box.title]: "done" }));
          updateLoadingStep(globalStepIndex + j, "completed");
        } else {
          const msg =
            settled.status === "rejected"
              ? settled.reason instanceof Error
                ? settled.reason.message
                : "Beklenmeyen hata"
              : (settled.value.error ?? "Literatür taraması başarısız oldu.");
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
  }, [subBoxes, addToLiteraturePool, showLoading, hideLoading, updateLoadingStep]);

  const allProcessed = useMemo(() => {
    if (subBoxes.length === 0) return false;
    return subBoxes.every((box) =>
      literaturePool.some((entry) => entry.subBoxTitle === box.title),
    );
  }, [subBoxes, literaturePool]);

  const handleFinalize = async () => {
    if (literaturePool.length === 0) {
      toast.error("Henüz işlenmiş literatür verisi bulunamadı.");
      return;
    }

    const finalSteps: LoadingStep[] = [
      { text: "Literatür havuzu veri tabanına yazılıyor...", status: "active" },
      { text: "Onboarding tamamlanıyor...", status: "idle" },
    ];

    showLoading(
      "Onboarding Tamamlanıyor",
      "Tüm literatür verileri kaydediliyor ve onboarding süreci sonlandırılıyor.",
      finalSteps,
    );

    setConfirming(true);
    const result = await confirmLiteratureAction({ literaturePool });
    if ("error" in result && result.error) {
      hideLoading();
      toast.error(result.error);
      setConfirming(false);
      return;
    }
    updateLoadingStep(0, "completed");
    updateLoadingStep(1, "active");
    await new Promise((r) => setTimeout(r, 400));
    hideLoading();
    resetStore();
    setConfirming(false);
    toast.success("Tebrikler! Onboarding süreciniz tamamlandı.");
    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <div className="p-4 bg-muted/50 rounded-full inline-flex mx-auto">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
          <p className="text-muted-foreground text-sm">
            Konu kutuları yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-24">
      <div className="flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto">
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-full">
          <BookOpen className="w-12 h-12 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Literatür Taraması
          </h1>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Her bir kutu için akademik veri tabanları taranıyor.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subBoxes.map((subBox, idx) => {
          const isCompleted = literaturePool.some(
            (e) => e.subBoxTitle === subBox.title,
          );
          return (
            <div
              key={idx}
              className="border border-border rounded-xl bg-card p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-primary/60" />
                <h3 className="text-base font-semibold text-foreground">
                  {subBox.title}
                </h3>
              </div>
              {subBox.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {subBox.description}
                </p>
              )}
              {isCompleted ? (
                <div className="space-y-4">
                  {literaturePool
                    .filter((e) => e.subBoxTitle === subBox.title)
                    .flatMap((entry) => entry.starterPack)
                    .map((article, ai) => (
                      <LiteratureArticleCard key={ai} article={article} />
                    ))}
                  {literaturePool
                    .filter((e) => e.subBoxTitle === subBox.title)
                    .some((entry) => entry.reservedPool.length > 0) && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/30">
                      <Library className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {literaturePool
                            .filter((e) => e.subBoxTitle === subBox.title)
                            .reduce(
                              (sum, e) => sum + e.reservedPool.length,
                              0,
                            )}
                        </span>{" "}
                        ek kaynak daha önerildi.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <SubBoxQuery
                  subBox={subBox}
                  status={boxStatuses[subBox.title] ?? "idle"}
                  errorMessage={boxErrors[subBox.title]}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center pt-4">
        {!allProcessed && !processing ? (
          <Button
            onClick={startReviewProcess}
            className="btn-academic-hero w-full sm:w-auto"
          >
            <BookOpen className="w-5 h-5 mr-2" />
            Akademik Literatür Taramasını Başlat
          </Button>
        ) : processing ? (
          <div className="text-center space-y-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">
              Alt kutular taranıyor...
            </p>
          </div>
        ) : (
          <Button
            onClick={handleFinalize}
            disabled={confirming}
            className="btn-academic-hero w-full sm:w-auto"
          >
            {confirming ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Kaydediliyor...
              </span>
            ) : (
              "Onayla ve Teze Başla."
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
