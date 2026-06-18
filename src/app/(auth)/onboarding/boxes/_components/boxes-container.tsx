"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  Rocket,
  Library,
  FileText,
  PlusCircle,
  WholeWord,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { confirmBoxesAction } from "../actions";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { GeminiThesisBox } from "@/lib/types";

export function BoxesContainer() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const { boxes, setBoxes } = useOnboardingStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) Check Zustand cache first — boxes are set here by the risk page's
      //    proceed flow (handleProceed). This prevents the DB fallback from
      //    overwriting the in-memory data with null.
      const cached = useOnboardingStore.getState().boxes;
      if (cached && cached.length > 0) {
        if (!cancelled) setLoading(false);
        return;
      }

      // 2) Fall back to the database.
      const { fetchBoxes } = await import("../../_lib/fetch-actions");
      const existing = await fetchBoxes();
      if (!cancelled) {
        if (existing.length > 0) {
          setBoxes(
            existing.map((b) => ({
              title: b.title,
              description: b.description ?? "",
              semanticSearchBlock: b.semanticSearchBlock ?? "",
              foundationalQueries: b.foundationalQueries ?? [],
              concepts: b.concepts ?? [],
            })),
          );
        } else {
          // No boxes anywhere — redirect to risk page to generate them.
          router.replace("/onboarding/risk");
          return;
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, setBoxes]);

  const handleConfirm = useCallback(async () => {
    if (!boxes) return;
    setConfirming(true);

    try {
      const result = await confirmBoxesAction(boxes);
      if ("error" in result && result.error) {
        toast.error(result.error);
        setConfirming(false);
        return;
      }

      const store = useOnboardingStore.getState();
      store.setLiteraturePool([]);
      store.setReportData(null);
      store.setEnrichmentPool([]);

      setConfirming(false);
      toast.success(
        "Konu kutuları kaydedildi. Literatür taramasına geçiliyor.",
      );
      router.push("/onboarding/literature-review");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
      setConfirming(false);
    }
  }, [boxes, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Kutular yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Defensive guard: boxes should never be null here (the mount useEffect
  // either restores them from Zustand/DB or redirects to the risk page).
  if (!boxes) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <div className="flex flex-col items-center text-center space-y-5 max-w-2xl mx-auto">
        <div className="relative inline-flex">
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-full">
            <CheckCircle2 className="w-12 h-12 text-primary" />
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Konu Kutuları Yapılandırıldı!
          </h1>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Tez matrisinizin çözümlenmesi tamamlandı. Aşağıdaki her bir kutu,
            literatür taraması sürecinde bağımsız olarak taranacaktır.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-min">
        {boxes.map((box, idx) => {
          const isLastOdd = boxes.length % 2 !== 0 && idx === boxes.length - 1;
          return (
            <BoxCard key={idx} box={box} index={idx} isLastOdd={isLastOdd} />
          );
        })}
      </div>

      <div className="flex flex-col items-center pt-4 pb-8">
        <Button
          onClick={handleConfirm}
          disabled={confirming}
          className="btn-academic-hero relative overflow-hidden bg-gradient-to-r from-primary to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-emerald-500/30 transition-all duration-300 group"
        >
          {confirming ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-3">
              <Rocket className="w-5 h-5 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-0.5" />
              <span className="tracking-wide">
                Kutuları Onayla ve Literatür Taramasını Başlat
              </span>
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

function BoxCard({
  box,
  index,
  isLastOdd = false,
}: {
  box: GeminiThesisBox;
  index: number;
  isLastOdd?: boolean;
}) {
  return (
    <Card
      className={`group/card grid grid-rows-[subgrid] row-span-4 p-6 bg-card border border-border/20 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_0_24px_-6px_#10b981]/20${isLastOdd ? " md:col-span-2" : ""}`}
    >
      <div className="[grid-row:1] space-y-3">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <PlusCircle className="w-3 h-3" />
          <span>Kutu {index + 1}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_#10b981]" />
          <CardTitle className="text-base font-semibold text-foreground leading-snug">
            {box.title}
          </CardTitle>
        </div>
      </div>

      {box.description && (
        <p className="[grid-row:2] text-sm text-muted-foreground leading-relaxed">
          {box.description}
        </p>
      )}

      {box.concepts && box.concepts.length > 0 && (
        <div className="[grid-row:3]">
          <div className="border-t border-border pt-3 border-b border-border pb-3">
            <div className="flex flex-wrap gap-1.5">
              {box.concepts.map((concept, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-xs text-primary font-semibold"
                >
                  <WholeWord className="w-3.5 h-3.5" />
                  {concept}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {box.foundationalQueries && box.foundationalQueries.length > 0 && (
        <div className="[grid-row:4] border-t border-border/10 pt-4 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Library className="w-3.5 h-3.5 text-primary" />
            Kurucu Literatür Temeli
          </h4>
          <ul className="space-y-2 pl-0.5">
            {box.foundationalQueries.slice(0, 3).map((fq, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
              >
                <FileText className="w-3.5 h-3.5 text-accent-foreground mt-0.5 shrink-0" />
                <span>
                  <strong className="font-medium text-foreground">
                    {fq.author}
                  </strong>{" "}
                  <span className="text-muted-foreground text-[11px]">
                    ({fq.publicationYear})
                  </span>{" "}
                  — <span className="italic text-foreground">{fq.title}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
