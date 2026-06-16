"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { generateBoxesAction, confirmBoxesAction } from "../actions";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { GeminiThesisBox } from "@/lib/types";

const loadingMessages = [
  "Tez matrisi ve araştırma tasarımı çözümleniyor...",
  "Akademik konu kutuları yapılandırılıyor...",
  "Literatür taraması birimleri oluşturuluyor...",
  "Semantik arama blokları optimize ediliyor...",
  "Son düzenlemeler yapılıyor...",
];

export function BoxesContainer() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const { boxes, setBoxes, resetStore } = useOnboardingStore();

  // Load existing boxes on mount — always checks DB first
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { fetchBoxes } = await import("../../lib/fetch-actions");
      const existing = await fetchBoxes();
      // With flat hierarchy, all boxes are direct children — use all boxes
      if (!cancelled) {
        if (existing.length > 0) {
          // DB has boxes — overwrite Zustand with fresh data
          setBoxes(
            existing.map((b) => ({
              title: b.title,
              description: b.description ?? "",
              semanticSearchBlock: b.semanticSearchBlock ?? "",
            })),
          );
        } else if (useOnboardingStore.getState().boxes) {
          // DB has no boxes but Zustand has stale data — clear so auto-generation fires
          setBoxes(null);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setBoxes]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    const result = await generateBoxesAction();
    if ("error" in result) {
      toast.error(result.error);
      setGenerating(false);
    } else {
      setBoxes(result.boxes);
      setGenerating(false);
    }
  }, [setBoxes]);

  useEffect(() => {
    if (!generating) {
      setCurrentStep(0);
      return;
    }
    const interval = setInterval(() => {
      setCurrentStep((prev) =>
        prev < loadingMessages.length - 1 ? prev + 1 : prev,
      );
    }, 2800);
    return () => clearInterval(interval);
  }, [generating]);

  const handleConfirm = useCallback(async () => {
    if (!boxes) return;
    setConfirming(true);
    const result = await confirmBoxesAction(boxes);
    if ("error" in result && result.error) {
      toast.error(result.error);
      setConfirming(false);
      return;
    }
    // Clear stale literature pool so literature-review re-processes from scratch
    useOnboardingStore.getState().setLiteraturePool([]);
    toast.success("Konu kutuları kaydedildi. Literatür taramasına geçiliyor.");
    router.push("/onboarding/literature-review");
  }, [boxes, router]);

  if (generating) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md">
        <div className="max-w-md w-full px-6 text-center space-y-6">
          <div className="relative flex items-center justify-center mx-auto w-16 h-16 bg-primary/10 border border-primary/20 rounded-full">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground tracking-tight">
              Konu Kutuları Yapılandırılıyor
            </h3>
            <p className="text-sm text-muted-foreground min-h-[40px] leading-relaxed">
              {loadingMessages[currentStep]}
            </p>
          </div>
          <div className="flex justify-center items-center gap-1.5 pt-2">
            {loadingMessages.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? "w-8 bg-primary" : idx < currentStep ? "w-2 bg-primary/40" : "w-2 bg-border"}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Kutular yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!boxes) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center space-y-6 max-w-lg mx-auto">
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-full inline-flex mx-auto">
            <Sparkles className="w-12 h-12 text-primary" />
          </div>
          <div className="space-y-2">
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
            className="btn-academic-hero w-full sm:w-auto"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Tez Planını Çıkar ve Kutuları Oluştur
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto">
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-full">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Konu Kutuları Yapılandırıldı!
          </h1>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Tez matrisinizin çözümlenmesi tamamlandı. Aşağıdaki her bir kutu,
            literatür taraması sürecinde bağımsız olarak taranacaktır.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boxes.map((box, idx) => (
          <Card
            key={idx}
            className="bg-card/40 border border-border hover:border-primary/30 transition-all"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary shrink-0" />
                <CardTitle className="text-base font-semibold text-foreground">
                  {box.title}
                </CardTitle>
              </div>
              {box.description && (
                <CardDescription className="text-sm text-muted-foreground leading-relaxed mt-2">
                  {box.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {box.semanticSearchBlock && (
                <div className="text-xs text-muted-foreground italic leading-relaxed border-t border-border/40 pt-3">
                  {box.semanticSearchBlock}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center space-y-11">
        <Button
          onClick={handleConfirm}
          disabled={confirming}
          className="btn-academic-hero w-full sm:w-auto"
        >
          {confirming ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            "Kutuları Onayla ve Literatür Taramasını Başlat"
          )}
        </Button>
      </div>
    </div>
  );
}
