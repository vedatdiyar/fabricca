"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmEnhancedThesisAction } from "../actions";
import type { EnhancedThesisData } from "@/lib/types";

interface EnrichmentViewProps {
  initialData: EnhancedThesisData;
}

/**
 * Zenginleştirilmiş Tez Matrisi İnceleme/Düzenleme Ekranı (Client Component).
 * Kullanıcının yapay zeka tarafından zenginleştirilmiş metinleri incelemesini
 * ve gerekirse düzenleyerek onaylamasını sağlar.
 */
export function EnrichmentView({ initialData }: EnrichmentViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [studyTitle, setStudyTitle] = useState(
    initialData.academicStudyTitle,
  );
  const [researchQuestion, setResearchQuestion] = useState(
    initialData.literatureResearchQuestion,
  );
  const [mainClaim, setMainClaim] = useState(
    initialData.refinedThesisClaim,
  );
  const [methodology, setMethodology] = useState(
    initialData.academicMethodologyDesign,
  );
  const [theoreticalFramework, setTheoreticalFramework] = useState(
    initialData.conceptualTheoreticalInfrastructure,
  );
  const [historicalSpatialLimits, setHistoricalSpatialLimits] = useState(
    initialData.historicalSpatialLimits,
  );

  const handleConfirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    startTransition(async () => {
      const result = await confirmEnhancedThesisAction({
        academicStudyTitle: studyTitle,
        literatureResearchQuestion: researchQuestion,
        refinedThesisClaim: mainClaim,
        academicMethodologyDesign: methodology,
        conceptualTheoreticalInfrastructure: theoreticalFramework,
        historicalSpatialLimits: historicalSpatialLimits,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Tez matrisiniz kaydedildi. Risk analizine geçiliyor.");
      router.push("/onboarding/risk");
    });
  };

  return (
    <Card className="w-full pt-6 border-border bg-card">
      <CardContent>
        <form
          onSubmit={handleConfirm}
          className="grid w-full grid-cols-1 gap-6 md:grid-cols-2"
        >
          <div className="space-y-2">
            <Label
              htmlFor="calismaBasligi"
              className="mb-4 block text-sm font-semibold text-foreground"
            >
              Çalışma Başlığı (Akademik)
            </Label>
            <Textarea
              id="calismaBasligi"
              value={studyTitle}
              onChange={(e) => setStudyTitle(e.target.value)}
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground scrollbar-theme"
            />
          </div>

          <div className="space-y-2 md:col-start-1">
            <Label
              htmlFor="arastirmaSorusu"
              className="mb-4 block text-sm font-semibold text-foreground"
            >
              Araştırma Sorusu (Literatürlü)
            </Label>
            <Textarea
              id="arastirmaSorusu"
              value={researchQuestion}
              onChange={(e) => setResearchQuestion(e.target.value)}
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground scrollbar-theme"
            />
          </div>

          <div className="space-y-2 md:row-start-3 md:col-start-1">
            <Label
              htmlFor="temelIddia"
              className="mb-4 block text-sm font-semibold text-foreground"
            >
              Temel İddia (Sav/Hipotez)
            </Label>
            <Textarea
              id="temelIddia"
              value={mainClaim}
              onChange={(e) => setMainClaim(e.target.value)}
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2 md:row-start-1 md:col-start-2">
            <Label
              htmlFor="metodoloji"
              className="mb-4 block text-sm font-semibold text-foreground"
            >
              Metodoloji Tasarımı (Akademik)
            </Label>
            <Textarea
              id="metodoloji"
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="kuramsalCerceve"
              className="mb-4 block text-sm font-semibold text-foreground"
            >
              Kavramsal ve Kuramsal Altyapı
            </Label>
            <Textarea
              id="kuramsalCerceve"
              value={theoreticalFramework}
              onChange={(e) => setTheoreticalFramework(e.target.value)}
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="tarihselMekansalSinirlar"
              className="mb-4 block text-sm font-semibold text-foreground"
            >
              Tarihsel / Mekânsal Sınırlar
            </Label>
            <Textarea
              id="tarihselMekansalSinirlar"
              value={historicalSpatialLimits}
              onChange={(e) => setHistoricalSpatialLimits(e.target.value)}
              required
              className="h-[120px] overflow-y-auto resize-none leading-relaxed bg-input border-border text-foreground"
            />
          </div>

          <div className="md:col-span-full">
            <Button
              type="submit"
              className="w-full font-semibold py-6"
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
