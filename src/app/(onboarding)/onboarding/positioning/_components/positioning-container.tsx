"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, BookOpen, Sparkles, Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { ThesisPositioning } from "@/db/schema";
import type { PositioningGlobalStatus } from "../_lib/validation";
import type { JuryAnalysisResult } from "../_services/analysis";
import { runPositioningPipelineAction } from "../actions";
import { useOnboardingNavigation } from "../../_hooks/use-onboarding-navigation";
import { PositioningReportView } from "./positioning-report-view";

interface PositioningContainerProps {
  initialRecord?: ThesisPositioning | null;
}

/**
 * PositioningContainer Component (FAZ 5 UI/UX).
 * The positioning pipeline runs during the matrix submit flow. This component
 * reads the pre-existing report from the DB and renders it. If no report
 * exists yet (fallback), it auto-triggers the pipeline and shows a loading
 * indicator while waiting.
 */
export function PositioningContainer({
  initialRecord,
}: PositioningContainerProps) {
  const queryClient = useQueryClient();
  const { proceedFromPositioning } = useOnboardingNavigation();
  const pipelineStartedRef = useRef(false);

  const hasExistingReport = !!(
    initialRecord &&
    initialRecord.globalStatus &&
    initialRecord.gapAnalysisSummary
  );

  const [reportData, setReportData] = useState<JuryAnalysisResult | null>(
    hasExistingReport
      ? {
          globalStatus: initialRecord.globalStatus as PositioningGlobalStatus,
          gapAnalysisSummary:
            (initialRecord.gapAnalysisSummary as JuryAnalysisResult["gapAnalysisSummary"]) ?? {
              literatureMapping: "",
              academicGap: "",
              originalContribution: "",
            },
          recommendedTheses:
            (initialRecord.recommendedTheses as JuryAnalysisResult["recommendedTheses"]) ??
            [],
        }
      : null,
  );

  useEffect(() => {
    if (hasExistingReport || pipelineStartedRef.current) return;
    pipelineStartedRef.current = true;

    let isMounted = true;

    const executePipeline = async () => {
      const matrixInput = initialRecord?.matrixInput;
      if (!matrixInput) {
        if (isMounted) {
          toast.error(
            "Konumlandırma matrisi bulunamadı. Lütfen çalışma matrisine geri dönün.",
          );
        }
        return;
      }

      try {
        const res = await runPositioningPipelineAction(matrixInput);
        if (!isMounted) return;

        if ("error" in res && res.error) {
          toast.error(res.error);
        } else if ("success" in res && res.success) {
          toast.success(
            "Konumlandırma analizi ve jüri değerlendirmesi tamamlandı!",
          );
          setReportData(res.report);
          queryClient.invalidateQueries({
            queryKey: ["onboarding-steps"],
          });
        }
      } catch {
        if (isMounted) {
          toast.error("Bir hata oluştu. Lütfen tekrar deneyin.");
        }
      }
    };

    void executePipeline();

    return () => {
      isMounted = false;
    };
  }, [hasExistingReport, initialRecord, queryClient]);

  if (reportData) {
    return (
      <PositioningReportView
        reportData={reportData}
        onConfirm={proceedFromPositioning}
      />
    );
  }

  return (
    <Card className="w-full p-8 my-6 flex flex-col items-center justify-center space-y-6 text-center border-primary/20 bg-card/50 backdrop-blur-sm shadow-md">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 rounded-full border-4 border-primary/20 animate-ping" />
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>

      <div className="space-y-2 max-w-lg">
        <h3 className="font-serif text-lg font-bold text-foreground">
          Akademik Konumlandırma & Jüri Analizi Çalıştırılıyor
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Literatür taranıyor, Cohere ile anlamsal süzme yapılıyor ve özgünlük
          boşluğu analiz ediliyor...
        </p>
      </div>

      <div className="w-full max-w-md space-y-3 pt-4 border-t border-border/60 text-left">
        <div className="flex items-center gap-3 text-xs text-foreground/80">
          <Search className="h-4 w-4 text-primary animate-pulse shrink-0" />
          <span>
            1. 3 katmanlı akademik arama sorguları üretiliyor (Gemini
            Flash-Lite)
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-foreground/80">
          <BookOpen className="h-4 w-4 text-primary animate-pulse shrink-0" />
          <span>
            2. Tezara veritabanı taranıyor & Cohere Rerank ile süzülüyor
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-foreground/80">
          <Sparkles className="h-4 w-4 text-primary animate-pulse shrink-0" />
          <span>
            3. Akademik jüri özgünlük boşluğu ve sentez raporunu hazırlıyor
          </span>
        </div>
      </div>
    </Card>
  );
}
