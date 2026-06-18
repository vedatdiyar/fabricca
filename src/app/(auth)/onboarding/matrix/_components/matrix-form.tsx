"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { LoadingStep } from "@/lib/store/onboarding-store";
import { enrichThesisMatrixAction, saveEnrichedMatrixAction } from "../actions";
import { fetchThesisMatrix } from "../../_lib/fetch-actions";

export function MatrixForm() {
  const router = useRouter();

  const [studyTitle, setStudyTitle] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [mainClaim, setMainClaim] = useState("");
  const [theoreticalFramework, setTheoreticalFramework] = useState("");
  const [methodology, setMethodology] = useState("");
  const [dataStrategy, setDataStrategy] = useState("");
  const [historicalLimits, setHistoricalLimits] = useState("");
  const [spatialLimits, setSpatialLimits] = useState("");
  const [analyticalFocus, setAnalyticalFocus] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const showLoading = useOnboardingStore((s) => s.showLoading);
  const hideLoading = useOnboardingStore((s) => s.hideLoading);
  const updateLoadingStep = useOnboardingStore((s) => s.updateLoadingStep);
  const isLoading = useOnboardingStore((s) => s.isLoading);

  useEffect(() => {
    let cancelled = false;
    fetchThesisMatrix().then((matrix) => {
      if (cancelled) return;
      if (matrix) {
        setStudyTitle(matrix.studyTitle);
        setResearchQuestion(matrix.researchQuestion);
        setMainClaim(matrix.mainClaim);
        setTheoreticalFramework(matrix.theoreticalFramework);
        setMethodology(matrix.methodology);
        setDataStrategy(matrix.dataStrategy);
        setHistoricalLimits(matrix.historicalLimits);
        setSpatialLimits(matrix.spatialLimits);
        setAnalyticalFocus(matrix.analyticalFocus);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
      hideLoading();
    };
  }, [hideLoading]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    const steps: LoadingStep[] = [
      {
        text: "Yapay zeka asistanı kavramsal ve kuramsal altyapıyı zenginleştiriyor...",
        status: "active",
      },
      {
        text: "Zenginleştirilmiş akademik matris veri tabanına işleniyor...",
        status: "idle",
      },
    ];

    showLoading(
      "Tez Matrisi Zenginleştiriliyor",
      "Yapay zeka asistanınız tez anayasanızı analiz ederek akademik bir yapıya dönüştürüyor.",
      steps,
    );

    try {
      const enrichResult = await enrichThesisMatrixAction({
        studyTitle,
        researchQuestion,
        mainClaim,
        theoreticalFramework,
        methodology,
        dataStrategy,
        historicalLimits,
        spatialLimits,
        analyticalFocus,
      });

      if ("error" in enrichResult) {
        hideLoading();
        toast.error(enrichResult.error);
        setIsPending(false);
        return;
      }

      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");

      const saveResult = await saveEnrichedMatrixAction(enrichResult.data);

      if ("error" in saveResult) {
        hideLoading();
        toast.error(saveResult.error);
        setIsPending(false);
        return;
      }

      updateLoadingStep(1, "completed");
      toast.success("Tez matrisi başarıyla zenginleştirildi.");
      hideLoading();
      router.push("/onboarding/enrichment");
    } catch {
      hideLoading();
      toast.error("Bir hata oluştu.");
    } finally {
      setIsPending(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full pt-6">
        <CardContent>
          <div className="flex items-center justify-center min-h-[30vh]">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full pt-6">
      <CardContent>
        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="calismaBasligi" className="block font-semibold text-foreground">
                Çalışma Başlığı
              </Label>
              <Textarea
                id="calismaBasligi"
                placeholder="Tez veya çalışma başlığınız"
                value={studyTitle}
                onChange={(e) => setStudyTitle(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arastirmaSorusu" className="block font-semibold text-foreground">
                Araştırma Sorusu
              </Label>
              <Textarea
                id="arastirmaSorusu"
                placeholder="Çalışmanızın temel araştırma sorusu ve varsa alt soruları"
                value={researchQuestion}
                onChange={(e) => setResearchQuestion(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temelIddia" className="block font-semibold text-foreground">
                Temel İddia / Hipotez
              </Label>
              <Textarea
                id="temelIddia"
                placeholder="Çalışmanızın savunduğu temel iddia veya hipotez"
                value={mainClaim}
                onChange={(e) => setMainClaim(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kuramsalCerceve" className="block font-semibold text-foreground">
                Kuramsal Çerçeve
              </Label>
              <Textarea
                id="kuramsalCerceve"
                placeholder="Kullanılan kuramlar, kavramsal setler ve alt okullar"
                value={theoreticalFramework}
                onChange={(e) => setTheoreticalFramework(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metodoloji" className="block font-semibold text-foreground">
                Veri Analiz Yöntemi
              </Label>
              <Textarea
                id="metodoloji"
                placeholder="Örn: Eleştirel Söylem Analizi, Süreç Takibi, İçerik Analizi"
                value={methodology}
                onChange={(e) => setMethodology(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="veriStratejisi" className="block font-semibold text-foreground">
                Veri Stratejisi
              </Label>
              <Textarea
                id="veriStratejisi"
                placeholder="Birincil/ikincil kaynak tipi, arşiv kapsamı, örneklem/veri kümesi"
                value={dataStrategy}
                onChange={(e) => setDataStrategy(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tarihselSinirlar" className="block font-semibold text-foreground">
                Tarihsel Sınırlar
              </Label>
              <Textarea
                id="tarihselSinirlar"
                placeholder="Olayın geçtiği net zaman aralığı (Örn: 1991-1999)"
                value={historicalLimits}
                onChange={(e) => setHistoricalLimits(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mekansalSinirlar" className="block font-semibold text-foreground">
                Mekânsal Sınırlar
              </Label>
              <Textarea
                id="mekansalSinirlar"
                placeholder="Coğrafi/mekânsal odak (Örn: Türkiye, Diyarbakır, İstanbul)"
                value={spatialLimits}
                onChange={(e) => setSpatialLimits(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
            <div className="md:col-span-full space-y-2">
              <Label htmlFor="analitikOdak" className="block font-semibold text-foreground">
                Analitik Odak
              </Label>
              <Textarea
                id="analitikOdak"
                placeholder="İncelenen aktörler, kurumlar veya söylemsel özneler"
                value={analyticalFocus}
                onChange={(e) => setAnalyticalFocus(e.target.value)}
                required
                className="textarea-academic"
              />
            </div>
          </div>

          <div className="md:col-span-full">
            <Button
              type="submit"
              className="btn-academic-hero w-full"
              disabled={isPending || isLoading}
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Zenginleştiriliyor...
                </span>
              ) : (
                "Tez Anayasasını Zenginleştir"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
