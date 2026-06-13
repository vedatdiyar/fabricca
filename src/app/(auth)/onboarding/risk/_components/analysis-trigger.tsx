"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { startOriginalityAnalysisAction } from "../actions";
import { ErrorDisplay } from "@/components/error-display";

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
  const hasCalledRef = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [secondsPassed, setSecondsPassed] = useState(0);

  const runAnalysis = (force = false) => {
    if (!force && hasCalledRef.current) {
      return;
    }
    hasCalledRef.current = true;

    setError(null);
    startTransition(async () => {
      try {
        const result = await startOriginalityAnalysisAction();
        if (result.error) {
          setError(result.error);
        } else if (result.success) {
          router.refresh();
        }
      } catch (err) {
        setError(err);
      }
    });
  };

  useEffect(() => {
    runAnalysis(false);
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
    secondsPassed <= 3
      ? 0
      : secondsPassed <= 24
        ? 1
        : secondsPassed <= 29
          ? 2
          : 3;

  if (error) {
    return <ErrorDisplay error={error} onRetry={() => runAnalysis(true)} />;
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
                  isActive || isCompleted
                    ? "text-foreground"
                    : "text-muted-foreground"
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
                <span className={isActive ? "font-medium" : ""}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
