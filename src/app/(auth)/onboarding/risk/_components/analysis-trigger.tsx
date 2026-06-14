"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { Sparkles, Loader2 } from "lucide-react";
import { searchAndSiftThesesAction, runJuryAnalysisAction } from "../actions";
import { ErrorDisplay } from "@/components/error-display";
import type { ScrapedTheses, TavilyEvaluationResponse } from "@/lib/types";

/**
 * Özgünlük ve Risk Analizini başlatan tetikleyici bileşen (Client Component).
 * TanStack Query useMutation ve cache mekanizması (staleTime: Infinity) ile
 * YÖKTEZ arama ve Gemini jüri analizi aşamalarını yönetir.
 */
const STEPS = [
  "Sorgu ve doğrulama parametreleri üretiliyor...",
  "Tavily ve Tezara paralel motorları koşturuluyor...",
  "Karşılaştırmalı literatür matrisi yapılandırılıyor...",
  "Nihai risk seviyesi ve tavsiyeler hazırlanıyor...",
];

export function AnalysisTrigger() {
  const queryClient = useQueryClient();
  const setStatus = useOnboardingStore((state) => state.setStatus);
  const statusRisk = useOnboardingStore((state) => state.status.risk);
  const setScrapedTheses = useOnboardingStore(
    (state) => state.setScrapedTheses,
  );
  const setJuryReport = useOnboardingStore((state) => state.setJuryReport);
  const setApprovedKeywords = useOnboardingStore(
    (state) => state.setApprovedKeywords,
  );
  const enrichedData = useOnboardingStore((state) => state.enrichedData);

  const [error, setError] = useState<string | null>(null);
  const [secondsPassed, setSecondsPassed] = useState(0);

  const isLoading = statusRisk === "loading";

  // Step 4: Gemini Jury Analysis Mutation
  const juryMutation = useMutation({
    mutationFn: (args: {
      scrapedTheses: ScrapedTheses;
      tavilyResults: TavilyEvaluationResponse;
      matrix: {
        studyTitle: string;
        researchQuestion: string;
        mainClaim: string;
        methodology: string;
        theoreticalFramework: string;
        historicalSpatialLimits: string;
      };
    }) =>
      runJuryAnalysisAction(
        args.scrapedTheses,
        args.tavilyResults,
        args.matrix,
      ),
    onMutate: () => {
      setStatus("risk", "loading");
    },
    onSuccess: (result) => {
      if ("error" in result && result.error) {
        setStatus("risk", "error");
        setError(result.error);
        return;
      }
      if ("success" in result && result.success && result.data) {
        setStatus("risk", "success");
        setJuryReport(result.data);
      }
    },
    onError: (err) => {
      setStatus("risk", "error");
      setError(
        err instanceof Error
          ? err.message
          : "Jüri analizi koşturulurken bir hata oluştu.",
      );
    },
  });

  // Step 3: YOKTEZ Search & Sifting Mutation
  const searchMutation = useMutation({
    mutationFn: searchAndSiftThesesAction,
    onMutate: () => {
      setStatus("risk", "loading");
    },
    onSuccess: (result) => {
      if ("error" in result && result.error) {
        setStatus("risk", "error");
        setError(result.error);
        return;
      }
      if (
        "success" in result &&
        result.success &&
        result.scrapedTheses &&
        result.tavilyResults &&
        result.keywords
      ) {
        // Sonuçları TanStack Query cache'ine mühürle ve staleTime'ı sonsuz yap
        queryClient.setQueryData(["scrapedTheses"], {
          scrapedTheses: result.scrapedTheses,
          tavilyResults: result.tavilyResults,
          keywords: result.keywords,
        });

        // Zustand store'a da set et
        setScrapedTheses(result.scrapedTheses);
        setApprovedKeywords(result.keywords);

        // Bir sonraki adım olan jüri analizini doğrudan tetikle
        if (enrichedData) {
          juryMutation.mutate({
            scrapedTheses: result.scrapedTheses,
            tavilyResults: result.tavilyResults,
            matrix: {
              studyTitle: enrichedData.academicStudyTitle,
              researchQuestion: enrichedData.literatureResearchQuestion,
              mainClaim: enrichedData.refinedThesisClaim,
              methodology: enrichedData.academicMethodologyDesign,
              theoreticalFramework: enrichedData.conceptualTheoreticalInfrastructure,
              historicalSpatialLimits: enrichedData.historicalSpatialLimits,
            },
          });
        }
      }
    },
    onError: (err) => {
      setStatus("risk", "error");
      setError(
        err instanceof Error
          ? err.message
          : "Arama motorları koşturulurken bir hata oluştu.",
      );
    },
  });

  // Analiz sürecini başlatan ana tetikleyici (Cache kontrolü ile)
  const triggerAnalysis = () => {
    setError(null);
    const cached = queryClient.getQueryData<{
      scrapedTheses: ScrapedTheses;
      tavilyResults: TavilyEvaluationResponse;
      keywords: string[];
    }>(["scrapedTheses"]);

    if (cached) {
      // Cache'deki keywords'ü Zustand store'a da aktar
      setApprovedKeywords(cached.keywords);

      // KRİTİK GÜVENCE: Eğer arama verisi cache'de mühürlü ise directly jüri analizini koştur
      if (enrichedData) {
        juryMutation.mutate({
          scrapedTheses: cached.scrapedTheses,
          tavilyResults: cached.tavilyResults,
          matrix: {
            studyTitle: enrichedData.academicStudyTitle,
            researchQuestion: enrichedData.literatureResearchQuestion,
            mainClaim: enrichedData.refinedThesisClaim,
            methodology: enrichedData.academicMethodologyDesign,
            theoreticalFramework: enrichedData.conceptualTheoreticalInfrastructure,
            historicalSpatialLimits: enrichedData.historicalSpatialLimits,
          },
        });
      } else {
        setError("Tez matrisi bulunamadı. Lütfen önce tez matrisini doldurun.");
      }
    } else {
      // Cache yoksa sıfırdan aramayı başlat
      if (enrichedData) {
        searchMutation.mutate({
          studyTitle: enrichedData.academicStudyTitle,
          researchQuestion: enrichedData.literatureResearchQuestion,
          mainClaim: enrichedData.refinedThesisClaim,
          methodology: enrichedData.academicMethodologyDesign,
          theoreticalFramework: enrichedData.conceptualTheoreticalInfrastructure,
          historicalSpatialLimits: enrichedData.historicalSpatialLimits,
        });
      } else {
        setError("Tez matrisi bulunamadı. Lütfen önce tez matrisini doldurun.");
      }
    }
  };

  useEffect(() => {
    // Sayfa yüklendiğinde analizi otomatik tetikle
    if (enrichedData) {
      triggerAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedData]);

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
