"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmEnhancedThesisAction } from "../actions";
import type { EnhancedThesisData } from "@/lib/types";

/**
 * Zenginleştirilmiş Tez Matrisi İnceleme/Düzenleme Ekranı (Client Component).
 * Kullanıcının yapay zeka tarafından zenginleştirilmiş metinleri incelemesini
 * ve gerekirse düzenleyerek onaylamasını sağlar.
 */
export function EnrichmentView() {
  const router = useRouter();
  const setStatus = useOnboardingStore((state) => state.setStatus);
  const statusEnrichment = useOnboardingStore(
    (state) => state.status.enrichment,
  );
  const updateEnrichedData = useOnboardingStore(
    (state) => state.updateEnrichedData,
  );
  const enrichedData = useOnboardingStore((state) => state.enrichedData);

  const [studyTitle, setStudyTitle] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [mainClaim, setMainClaim] = useState("");
  const [methodology, setMethodology] = useState("");
  const [theoreticalFramework, setTheoreticalFramework] = useState("");
  const [historicalSpatialLimits, setHistoricalSpatialLimits] = useState("");

  // Client-side redirect shield if no matrix enrichment is present
  useEffect(() => {
    if (!enrichedData) {
      toast.error(
        "Zenginleştirilmiş tez matrisi bulunamadı. Lütfen önce formu doldurun.",
      );
      router.push("/onboarding/matrix");
    }
  }, [enrichedData, router]);

  // Sync state once enrichedData is loaded from client store (hydration guard)
  useEffect(() => {
    if (enrichedData) {
      setStudyTitle(enrichedData.academicStudyTitle);
      setResearchQuestion(enrichedData.literatureResearchQuestion);
      setMainClaim(enrichedData.refinedThesisClaim);
      setMethodology(enrichedData.academicMethodologyDesign);
      setTheoreticalFramework(enrichedData.conceptualTheoreticalInfrastructure);
      setHistoricalSpatialLimits(enrichedData.historicalSpatialLimits);
    }
  }, [enrichedData]);

  const mutation = useMutation({
    mutationFn: confirmEnhancedThesisAction,
    onMutate: () => {
      setStatus("enrichment", "loading");
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        setStatus("enrichment", "success");
        updateEnrichedData(variables);
        toast.success("Tez matrisiniz kaydedildi. Risk analizine geçiliyor.");
        router.push("/onboarding/risk");
      } else {
        setStatus("enrichment", "error");
        toast.error(
          result.error || "Tez matrisi onaylanırken bir hata oluştu.",
        );
      }
    },
    onError: (err) => {
      setStatus("enrichment", "error");
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu.");
    },
  });

  const handleConfirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate({
      academicStudyTitle: studyTitle,
      literatureResearchQuestion: researchQuestion,
      refinedThesisClaim: mainClaim,
      academicMethodologyDesign: methodology,
      conceptualTheoreticalInfrastructure: theoreticalFramework,
      historicalSpatialLimits: historicalSpatialLimits,
    });
  };

  const isPending = statusEnrichment === "loading";

  return (
    <Card className="w-full pt-6">
      <CardContent>
        <form
          onSubmit={handleConfirm}
          className="grid w-full grid-cols-1 gap-6 md:grid-cols-2"
        >
          <div className="space-y-2">
            <Label
              htmlFor="calismaBasligi"
              className="mb-4 block font-semibold text-foreground"
            >
              Çalışma Başlığı (Akademik)
            </Label>
            <Textarea
              id="calismaBasligi"
              value={studyTitle}
              onChange={(e) => setStudyTitle(e.target.value)}
              required
              className="textarea-academic"
            />
          </div>

          <div className="space-y-2 md:col-start-1">
            <Label
              htmlFor="arastirmaSorusu"
              className="mb-4 block font-semibold text-foreground"
            >
              Araştırma Sorusu (Literatürlü)
            </Label>
            <Textarea
              id="arastirmaSorusu"
              value={researchQuestion}
              onChange={(e) => setResearchQuestion(e.target.value)}
              required
              className="textarea-academic"
            />
          </div>

          <div className="space-y-2 md:row-start-3 md:col-start-1">
            <Label
              htmlFor="temelIddia"
              className="mb-4 block font-semibold text-foreground"
            >
              Temel İddia (Sav/Hipotez)
            </Label>
            <Textarea
              id="temelIddia"
              value={mainClaim}
              onChange={(e) => setMainClaim(e.target.value)}
              required
              className="textarea-academic"
            />
          </div>

          <div className="space-y-2 md:row-start-1 md:col-start-2">
            <Label
              htmlFor="metodoloji"
              className="mb-4 block font-semibold text-foreground"
            >
              Metodoloji Tasarımı (Akademik)
            </Label>
            <Textarea
              id="metodoloji"
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              required
              className="textarea-academic"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="kuramsalCerceve"
              className="mb-4 block font-semibold text-foreground"
            >
              Kavramsal ve Kuramsal Altyapı
            </Label>
            <Textarea
              id="kuramsalCerceve"
              value={theoreticalFramework}
              onChange={(e) => setTheoreticalFramework(e.target.value)}
              required
              className="textarea-academic"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="tarihselMekansalSinirlar"
              className="mb-4 block font-semibold text-foreground"
            >
              Tarihsel / Mekânsal Sınırlar
            </Label>
            <Textarea
              id="tarihselMekansalSinirlar"
              value={historicalSpatialLimits}
              onChange={(e) => setHistoricalSpatialLimits(e.target.value)}
              required
              className="textarea-academic"
            />
          </div>

          <div className="md:col-span-full">
            <Button
              type="submit"
              className="btn-academic-hero w-full"
              disabled={isPending}
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Kaydediliyor...
                </span>
              ) : (
                "Onayla ve İlerle"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
