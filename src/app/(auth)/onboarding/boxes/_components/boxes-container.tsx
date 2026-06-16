"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  Sparkles,
  Rocket,
  Layers,
  Library,
  FileText,
  PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateBoxesAction, confirmBoxesAction } from "../actions";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { LoadingStep } from "@/lib/store/onboarding-store";
import type { GeminiThesisBox } from "@/lib/types";

const GENERATION_STEPS: LoadingStep[] = [
  { text: "Tez matrisi ve araştırma tasarımı çözümleniyor...", status: "idle" },
  { text: "Akademik konu kutuları yapılandırılıyor...", status: "idle" },
  { text: "Semantik arama blokları optimize ediliyor...", status: "idle" },
  { text: "Son düzenlemeler yapılıyor...", status: "idle" },
];

const SAVE_STEPS: LoadingStep[] = [
  { text: "Konu kutuları veri tabanına kaydediliyor...", status: "active" },
  { text: "Literatür taraması sayfasına yönlendiriliyor...", status: "idle" },
];

export function BoxesContainer() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const { boxes, setBoxes, resetStore } = useOnboardingStore();
  const showLoading = useOnboardingStore((s) => s.showLoading);
  const hideLoading = useOnboardingStore((s) => s.hideLoading);
  const updateLoadingStep = useOnboardingStore((s) => s.updateLoadingStep);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { fetchBoxes } = await import("../../lib/fetch-actions");
      const existing = await fetchBoxes();
      if (!cancelled) {
        if (existing.length > 0) {
          setBoxes(
            existing.map((b) => ({
              title: b.title,
              description: b.description ?? "",
              semanticSearchBlock: b.semanticSearchBlock ?? "",
              foundationalQueries: [],
              concepts: b.concepts ?? [],
            })),
          );
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setBoxes]);

  const handleGenerate = useCallback(async () => {
    const steps = GENERATION_STEPS.map((s) => ({ ...s }));
    steps[0].status = "active";
    showLoading(
      "Konu Kutuları Yapılandırılıyor",
      "Tez matrisiniz çözümlenerek bağımsız literatür taraması kutularına dönüştürülüyor.",
      steps,
    );

    const result = await generateBoxesAction();
    if ("error" in result) {
      hideLoading();
      toast.error(result.error);
    } else {
      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "completed");
      updateLoadingStep(2, "completed");
      updateLoadingStep(3, "completed");
      await new Promise((r) => setTimeout(r, 400));
      hideLoading();
      setBoxes(result.boxes);
    }
  }, [setBoxes, showLoading, hideLoading, updateLoadingStep]);

  const handleConfirm = useCallback(async () => {
    if (!boxes) return;
    setConfirming(true);

    showLoading(
      "Konu Kutuları Kaydediliyor",
      "Oluşturulan konu kutuları veri tabanına kaydediliyor.",
      SAVE_STEPS,
    );

    const result = await confirmBoxesAction(boxes);
    if ("error" in result && result.error) {
      hideLoading();
      toast.error(result.error);
      setConfirming(false);
      return;
    }

    updateLoadingStep(0, "completed");
    updateLoadingStep(1, "active");
    await new Promise((r) => setTimeout(r, 300));
    hideLoading();
    setConfirming(false);
    toast.success("Konu kutuları kaydedildi. Literatür taramasına geçiliyor.");
    router.push("/onboarding/literature-review");
  }, [boxes, router, showLoading, hideLoading, updateLoadingStep]);

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

  if (!boxes) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center space-y-8 max-w-lg mx-auto">
          <div className="relative inline-flex">
            <div className="p-5 bg-primary/10 border border-primary/20 rounded-full">
              <Layers className="w-14 h-14 text-primary" />
            </div>
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary shadow-[0_0_8px_#10b981] animate-pulse" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Konu Kutuları
            </h1>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Tez matrisiniz çözümlenerek bağımsız literatür taraması kutularına
              dönüştürülecek. Her bir kutu, tezinizin belirli bir yönünü temsil
              eder ve doğrudan akademik veri tabanlarında arama yapmak için
              kullanılacak.
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            className="btn-academic-hero w-full sm:w-auto bg-gradient-to-r from-primary to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-emerald-500/30 transition-all duration-300"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Tez Planını Çıkar ve Kutuları Oluştur
          </Button>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      className={`group/card h-full flex flex-col bg-card border-border/60 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_0_24px_-6px_#10b981]/20${isLastOdd ? " md:col-span-2" : ""}`}
    >
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center gap-1.5 text-primary/60 text-xs">
          <PlusCircle className="w-3 h-3" />
          <span>Kutu {index + 1}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_#10b981]" />
          <CardTitle className="text-base font-semibold text-foreground leading-snug">
            {box.title}
          </CardTitle>
        </div>
        {box.description && (
          <CardDescription className="text-sm text-muted-foreground leading-relaxed">
            {box.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 pt-0">
        {box.concepts && box.concepts.length > 0 && (
          <div className="space-y-2 py-3">
            <div className="border-t border-border" />
            <div className="flex flex-wrap gap-1.5">
              {box.concepts.map((concept, i) => (
                <span
                  key={i}
                  className="px-2 py-1 rounded bg-primary/10 text-[10px] text-primary font-semibold"
                >
                  {concept}
                </span>
              ))}
            </div>
            <div className="border-b border-border" />
          </div>
        )}

        {box.foundationalQueries && box.foundationalQueries.length > 0 && (
          <div className="mt-auto pt-2 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Library className="w-3.5 h-3.5 text-primary" />
              Kurucu Literatür Temeli
            </h4>
            <ul className="space-y-2 pl-0.5">
              {box.foundationalQueries.slice(0, 3).map((fq, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs leading-relaxed text-foreground/90"
                >
                  <FileText className="w-3.5 h-3.5 text-accent-foreground mt-0.5 shrink-0" />
                  <span>
                    <strong className="font-medium text-foreground">
                      {fq.author}
                    </strong>{" "}
                    <span className="text-muted-foreground/60 text-[11px]">
                      ({fq.publicationYear})
                    </span>{" "}
                    —{" "}
                    <span className="italic text-foreground/80">
                      "{fq.title}"
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
