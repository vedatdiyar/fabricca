"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, AlertCircle, BookOpen, ShieldCheck, Brain, Cpu, MapPin, Archive, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processLiteratureReviewAction, confirmLiteratureAction } from "../actions";
import { fetchBoxes } from "../../lib/fetch-actions";
import { LiteratureArticleCard } from "./literature-article-card";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { GeminiThesisBox, LiteraturePoolEntry } from "@/lib/types";
import type { LiteratureReviewResult } from "../actions";

const categoryMeta: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; bgClass: string; textClass: string }> = {
  intro: { label: "Giriş ve Temel İddia", icon: ShieldCheck, bgClass: "bg-emerald-500/10 border border-emerald-500/20", textClass: "text-emerald-400" },
  theory: { label: "Teorik Zemin", icon: Brain, bgClass: "bg-blue-500/10 border border-blue-500/20", textClass: "text-blue-400" },
  methodology: { label: "Yöntem Literatürü", icon: Cpu, bgClass: "bg-amber-500/10 border border-amber-500/20", textClass: "text-amber-400" },
  context: { label: "Tarihsel ve Mekânsal Bağlam", icon: MapPin, bgClass: "bg-violet-500/10 border border-violet-500/20", textClass: "text-violet-400" },
  primary_source: { label: "Birincil Özneler ve Arşivler", icon: Archive, bgClass: "bg-rose-500/10 border border-rose-500/20", textClass: "text-rose-400" },
};

const parentBoxes = [
  { category: "intro", title: "Giriş ve Temel İddia", description: "Tezin temel iddiaları ve giriş çerçevesi." },
  { category: "theory", title: "Teorik Zemin", description: "Kuramsal çerçeve ve teorik altyapı kutuları." },
  { category: "methodology", title: "Yöntem Literatürü", description: "Metodoloji ve araştırma yöntemi kutuları." },
  { category: "context", title: "Tarihsel ve Mekânsal Bağlam", description: "Tarihsel sınırlar ve coğrafi/mekânsal bağlam kutuları." },
  { category: "primary_source", title: "Birincil Özneler ve Arşivler", description: "İncelenen birincil özneler, arşivler ve belgeler." },
];

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
        <p className="text-sm text-destructive font-medium mb-1">Tarama hatası</p>
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
            <span className="font-semibold text-foreground">{entry.reservedPool.length}</span> ek kaynak daha önerildi.
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
  const [boxStatuses, setBoxStatuses] = useState<Record<string, BoxStatus>>({});
  const [boxErrors, setBoxErrors] = useState<Record<string, string>>({});
  const store = useOnboardingStore();
  const literaturePool = store.literaturePool ?? [];
  const addToLiteraturePool = store.addToLiteraturePool;
  const resetStore = store.resetStore;

  useEffect(() => {
    fetchBoxes().then((allBoxes) => {
      const children = allBoxes.filter((b) => b.parentId !== null);
      const freshTitles = new Set(children.map((b) => b.title));
      const currentStore = useOnboardingStore.getState();
      const poolTitles = new Set(currentStore.literaturePool.map((e) => e.subBoxTitle));
      // If the set of sub-boxes doesn't match literaturePool, reset the pool
      if (freshTitles.size !== poolTitles.size ||
          ![...freshTitles].every((t) => poolTitles.has(t))) {
        useOnboardingStore.getState().setLiteraturePool([]);
      }
      setSubBoxes(children.map((b) => ({
        category: b.category,
        title: b.title,
        description: b.description ?? "",
        theorists: b.theorists,
        concepts: b.concepts,
        queries: b.queries,
      })));
      setLoading(false);
    });
  }, []);

  // Chunked parallel processing: 2 boxes at a time
  useEffect(() => {
    if (subBoxes.length === 0) return;

    const currentStore = useOnboardingStore.getState();
    const allDone = subBoxes.every((box) =>
      currentStore.literaturePool.some((e) => e.subBoxTitle === box.title),
    );
    if (allDone) return;

    let cancelled = false;
    const CHUNK_SIZE = 2;

    (async () => {
      for (let i = 0; i < subBoxes.length && !cancelled; i += CHUNK_SIZE) {
        const chunk = subBoxes.slice(i, i + CHUNK_SIZE);

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
              theorists: box.theorists,
              concepts: box.concepts,
              queries: box.queries,
            }),
          ),
        );

        if (cancelled) break;

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
          } else {
            const msg =
              settled.status === "rejected"
                ? settled.reason instanceof Error
                  ? settled.reason.message
                  : "Beklenmeyen hata"
                : settled.value.error ?? "Literatür taraması başarısız oldu.";
            setBoxErrors((prev) => ({ ...prev, [box.title]: msg }));
            setBoxStatuses((prev) => ({ ...prev, [box.title]: "error" }));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subBoxes, addToLiteraturePool]);

  const groupedBoxes = useMemo(() => {
    return parentBoxes.map((parent) => ({
      ...parent,
      subBoxes: subBoxes.filter((b) => b.category === parent.category),
    }));
  }, [subBoxes]);

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
    setConfirming(true);
    const result = await confirmLiteratureAction({ literaturePool });
    if ("error" in result && result.error) {
      toast.error(result.error);
      setConfirming(false);
      return;
    }
    resetStore();
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
          <p className="text-muted-foreground text-sm">Konu kutuları yükleniyor...</p>
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
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Literatür Taraması</h1>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Her bir alt kutu için akademik veri tabanları taranıyor.
          </p>
        </div>
      </div>

      <div className="space-y-10">
        {groupedBoxes.map((parent) => {
          const meta = categoryMeta[parent.category] ?? { label: parent.title, icon: BookOpen, bgClass: "bg-muted border border-border", textClass: "text-foreground" };
          const IconComponent = meta.icon;
          if (parent.subBoxes.length === 0) return null;
          return (
            <div key={parent.category} className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-border">
                <div className={`p-2 rounded-lg ${meta.bgClass}`}><IconComponent className="w-5 h-5" /></div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{meta.label}</h2>
                  <p className="text-sm text-muted-foreground">{parent.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {parent.subBoxes.map((subBox, idx) => {
                  const isCompleted = literaturePool.some((e) => e.subBoxTitle === subBox.title);
                  return (
                    <div key={idx} className="border border-border rounded-xl bg-card p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 rounded-full bg-primary/60" />
                        <h3 className="text-base font-semibold text-foreground">{subBox.title}</h3>
                      </div>
                      {subBox.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed -mt-2 ml-3.5">{subBox.description}</p>
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
                                    .reduce((sum, e) => sum + e.reservedPool.length, 0)}
                                </span> ek kaynak daha önerildi.
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
            </div>
          );
        })}
      </div>

      <div className="flex justify-center pt-4">
        <Button onClick={handleFinalize} disabled={!allProcessed || confirming} className="btn-academic-hero w-full sm:w-auto">
          {confirming ? (
            <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Kaydediliyor...</span>
          ) : (
            "Onayla ve Teze Başla."
          )}
        </Button>
      </div>
    </div>
  );
}
