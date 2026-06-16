"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmEnhancedThesisAction } from "../actions";
import { fetchThesisMatrix } from "../../lib/fetch-actions";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { LoadingStep } from "@/lib/store/onboarding-store";
import type { EnhancedThesisData } from "@/lib/types";

export function EnrichmentView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const showLoading = useOnboardingStore((s) => s.showLoading);
  const hideLoading = useOnboardingStore((s) => s.hideLoading);
  const isLoading = useOnboardingStore((s) => s.isLoading);

  const [studyTitle, setStudyTitle] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [mainClaim, setMainClaim] = useState("");
  const [methodology, setMethodology] = useState("");
  const [theoreticalFramework, setTheoreticalFramework] = useState("");
  const [historicalSpatialLimits, setHistoricalSpatialLimits] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchThesisMatrix().then((matrix) => {
      if (cancelled) return;
      if (!matrix) {
        toast.error("Zenginleştirilmiş tez matrisi bulunamadı.");
        router.push("/onboarding/matrix");
        return;
      }
      setStudyTitle(matrix.studyTitle);
      setResearchQuestion(matrix.researchQuestion);
      setMainClaim(matrix.mainClaim);
      setMethodology(matrix.methodology);
      setTheoreticalFramework(matrix.theoreticalFramework);
      setHistoricalSpatialLimits(matrix.historicalSpatialLimits);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [router]);

  const handleConfirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    const steps: LoadingStep[] = [
      { text: "Veriler doğrulanıyor...", status: "active" },
      { text: "Veri tabanına yazılıyor...", status: "idle" },
    ];

    showLoading(
      "Tez Matrisi Kaydediliyor",
      "Zenginleştirilmiş tez matrisiniz veri tabanına kaydediliyor ve bir sonraki adıma hazırlanıyor.",
      steps,
    );

    const data: EnhancedThesisData = {
      academicStudyTitle: studyTitle,
      literatureResearchQuestion: researchQuestion,
      refinedThesisClaim: mainClaim,
      conceptualTheoreticalInfrastructure: theoreticalFramework,
      academicMethodologyDesign: methodology,
      historicalSpatialLimits: historicalSpatialLimits,
    };

    try {
      const result = await confirmEnhancedThesisAction(data);
      if (result.error) {
        hideLoading();
        toast.error(result.error);
        setIsPending(false);
        return;
      }
      // Clear stale downstream Zustand state so risk and boxes re-trigger on next visit
      useOnboardingStore.getState().setBoxes(null);
      useOnboardingStore.getState().setLiteraturePool([]);
      hideLoading();
      setIsPending(false);
      toast.success("Tez matrisiniz kaydedildi. Risk analizine geçiliyor.");
      router.push("/onboarding/risk");
    } catch {
      hideLoading();
      toast.error("Bir hata oluştu.");
      setIsPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Card className="w-full pt-6">
        <CardContent>
          <form onSubmit={handleConfirm} className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="calismaBasligi" className="mb-4 block font-semibold text-foreground">
                Çalışma Başlığı (Akademik)
              </Label>
              <Textarea id="calismaBasligi" value={studyTitle} onChange={(e) => setStudyTitle(e.target.value)} required className="textarea-academic" />
            </div>
            <div className="space-y-2 md:col-start-1">
              <Label htmlFor="arastirmaSorusu" className="mb-4 block font-semibold text-foreground">
                Araştırma Sorusu (Literatürlü)
              </Label>
              <Textarea id="arastirmaSorusu" value={researchQuestion} onChange={(e) => setResearchQuestion(e.target.value)} required className="textarea-academic" />
            </div>
            <div className="space-y-2 md:row-start-3 md:col-start-1">
              <Label htmlFor="temelIddia" className="mb-4 block font-semibold text-foreground">
                Temel İddia (Sav/Hipotez)
              </Label>
              <Textarea id="temelIddia" value={mainClaim} onChange={(e) => setMainClaim(e.target.value)} required className="textarea-academic" />
            </div>
            <div className="space-y-2 md:row-start-1 md:col-start-2">
              <Label htmlFor="metodoloji" className="mb-4 block font-semibold text-foreground">
                Metodoloji Tasarımı (Akademik)
              </Label>
              <Textarea id="metodoloji" value={methodology} onChange={(e) => setMethodology(e.target.value)} required className="textarea-academic" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kuramsalCerceve" className="mb-4 block font-semibold text-foreground">
                Kavramsal ve Kuramsal Altyapı
              </Label>
              <Textarea id="kuramsalCerceve" value={theoreticalFramework} onChange={(e) => setTheoreticalFramework(e.target.value)} required className="textarea-academic" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tarihselMekansalSinirlar" className="mb-4 block font-semibold text-foreground">
                Tarihsel / Mekânsal Sınırlar
              </Label>
              <Textarea id="tarihselMekansalSinirlar" value={historicalSpatialLimits} onChange={(e) => setHistoricalSpatialLimits(e.target.value)} required className="textarea-academic" />
            </div>
            <div className="md:col-span-full">
              <Button type="submit" className="btn-academic-hero w-full" disabled={isPending || isLoading}>
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
    </>
  );
}
