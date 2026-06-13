"use client";

import { useEffect, useState, useTransition } from "react";
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

export interface AnalysisTriggerProps {
  initialStep: string;
}

export function AnalysisTrigger({ initialStep }: AnalysisTriggerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPolling, setIsPolling] = useState(
    initialStep === "originality_report_processing",
  );
  const [error, setError] = useState<unknown>(null);
  const [secondsPassed, setSecondsPassed] = useState(0);

  const isLoading = isPending || isPolling;

  const triggerAnalysis = () => {
    setError(null);
    setIsPolling(false);
    startTransition(async () => {
      try {
        const result = await startOriginalityAnalysisAction();
        if (result.error) {
          setError(result.error);
          sessionStorage.removeItem("originality_analysis_triggered");
        } else if (result.success) {
          if (result.isProcessing) {
            setIsPolling(true);
          } else {
            sessionStorage.removeItem("originality_analysis_triggered");
            router.refresh();
          }
        }
      } catch (err) {
        setError(err);
        sessionStorage.removeItem("originality_analysis_triggered");
      }
    });
  };

  useEffect(() => {
    if (initialStep === "originality_report_processing") {
      setIsPolling(true);
      return;
    }

    const alreadyTriggered = sessionStorage.getItem(
      "originality_analysis_triggered",
    );
    if (alreadyTriggered) {
      setIsPolling(true);
      return;
    }

    sessionStorage.setItem("originality_analysis_triggered", "true");
    triggerAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStep]);

  useEffect(() => {
    if (!isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/onboarding/risk/status", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const res = await response.json();
        if (res.success && res.step) {
          if (res.step === "originality_report_completed") {
            clearInterval(pollInterval);
            setIsPolling(false);
            sessionStorage.removeItem("originality_analysis_triggered");
            router.refresh();
          } else if (res.step === "originality_report") {
            // Analiz başarısız olmuş ve geri alınmış demektir
            clearInterval(pollInterval);
            setIsPolling(false);
            sessionStorage.removeItem("originality_analysis_triggered");
            setError("Özgünlük analizi sunucu tarafında başarısız oldu.");
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isPolling, router]);

  useEffect(() => {
    if (!isLoading) {
      setSecondsPassed(0);
      return;
    }
    const interval = setInterval(() => {
      setSecondsPassed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const activeStep =
    secondsPassed <= 3
      ? 0
      : secondsPassed <= 24
        ? 1
        : secondsPassed <= 29
          ? 2
          : 3;

  if (error) {
    return <ErrorDisplay error={error} onRetry={triggerAnalysis} />;
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
