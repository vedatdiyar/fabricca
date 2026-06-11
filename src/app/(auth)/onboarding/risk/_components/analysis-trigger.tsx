"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { startOriginalityAnalysisAction } from "../actions";
import { Button } from "@/components/ui/button";

/**
 * Özgünlük ve Risk Analizini istemci tarafında başlatan tetikleyici bileşen.
 * Sayfa yüklendiğinde analizi asenkron olarak tetikler ve Next.js'in revalidatePath
 * render-time hatasını (POST isteği bağlamında çalıştığı için) önler.
 */
const STEPS = [
  "Sorgu ve doğrulama parametreleri üretiliyor...",
  "Tavily ve Tezara paralel motorları koşturuluyor...",
  "Karşılaştırmalı literatür matrisi yapılandırılıyor...",
  "Nihai risk seviyesi ve tavsiyeler hazırlanıyor...",
];

export function AnalysisTrigger() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [secondsPassed, setSecondsPassed] = useState(0);

  const runAnalysis = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await startOriginalityAnalysisAction();
        if (result.error) {
          setError(result.error);
        } else if (result.success) {
          // Başarılı olduğunda, revalidatePath server action içinde çağrıldı.
          // İstemci tarafında router.refresh() tetikleyerek yeni durumun (raporun) yüklenmesini sağlıyoruz.
          router.refresh();
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Analiz sırasında beklenmeyen bir hata oluştu.",
        );
      }
    });
  };

  useEffect(() => {
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isPending) {
      setSecondsPassed(0);
      return;
    }
    const interval = setInterval(() => {
      setSecondsPassed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPending]);

  const activeStep =
    secondsPassed <= 3 ? 0 :
    secondsPassed <= 24 ? 1 :
    secondsPassed <= 29 ? 2 :
    3;

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center justify-center space-y-6 max-w-md mx-auto text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-card border border-destructive text-destructive">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Analiz Başlatılamadı
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {error}
            </p>
          </div>

          <Button onClick={runAnalysis} disabled={isPending} className="gap-2">
            <RefreshCw
              className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`}
            />
            Yeniden Dene
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center justify-center space-y-8 max-w-md mx-auto text-center">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <Sparkles className="w-6 h-6 text-primary absolute animate-pulse" />
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            Risk Analiz Motorları Çalışıyor
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Yapay zeka asistanınız tez matrisinizi inceliyor, veri tabanlarını
            tarıyor ve risk raporunu hazırlıyor. Bu işlem 15-30 saniye
            sürebilir.
          </p>
        </div>

        <div className="w-full bg-muted border border-border rounded-lg p-5 text-left space-y-4">
          {STEPS.map((label, index) => {
            const isActive = activeStep === index;
            const isCompleted = activeStep > index;
            return (
              <div
                key={index}
                className={`flex items-center gap-3 text-sm ${
                  isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isActive
                      ? "bg-primary animate-ping"
                      : isCompleted
                        ? "bg-primary"
                        : "bg-border"
                  }`}
                ></div>
                <span className={isActive ? "font-medium" : ""}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
