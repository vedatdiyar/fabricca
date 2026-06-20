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
import {
  extractQueriesAction,
  executeSearchAction,
  siftThesesAction,
  finalizeJuryAnalysisAction,
} from "../../risk/actions";
import { fetchThesisMatrix } from "../../_lib/fetch-actions";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import type { LoadingStep } from "@/lib/store/onboarding-store";
import { getErrorDisplay } from "@/lib/error-utils";
import type { EnhancedThesisData } from "@/lib/types";

const ANALYSIS_STEPS: LoadingStep[] = [
  { text: "Sorgu ve doğrulama parametreleri üretiliyor...", status: "idle" },
  {
    text: "Tavily ve Tezara paralel motorları koşturuluyor...",
    status: "idle",
  },
  {
    text: "Karşılaştırmalı literatür matrisi yapılandırılıyor...",
    status: "idle",
  },
  { text: "Nihai risk seviyesi ve tavsiyeler hazırlanıyor...", status: "idle" },
];

export function EnrichmentView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);

  const [studyTitle, setStudyTitle] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [theoreticalFramework, setTheoreticalFramework] = useState("");
  const [methodology, setMethodology] = useState("");
  const [researchScope, setResearchScope] = useState("");
  const [mainClaim, setMainClaim] = useState("");

  const showLoading = useOnboardingStore((s) => s.showLoading);
  const hideLoading = useOnboardingStore((s) => s.hideLoading);
  const updateLoadingStep = useOnboardingStore((s) => s.updateLoadingStep);
  const setBoxes = useOnboardingStore((s) => s.setBoxes);
  const setLiteraturePool = useOnboardingStore((s) => s.setLiteraturePool);

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
      setTheoreticalFramework(matrix.theoreticalFramework);
      setMethodology(matrix.methodology);
      setResearchScope(matrix.researchScope);
      setMainClaim(matrix.mainClaim);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleConfirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    const data: EnhancedThesisData = {
      studyTitle,
      researchQuestion,
      theoreticalFramework,
      methodology,
      researchScope,
      mainClaim,
    };

    try {
      const result = await confirmEnhancedThesisAction(data);
      if (result.error) {
        toast.error(result.error);
        setIsPending(false);
        return;
      }

      // Clear stale downstream Zustand state (including any cached report data)
      setBoxes(null);
      setLiteraturePool([]);
      useOnboardingStore.getState().clearReportData();

      // Build matrix input for analysis pipeline
      const matrixInput = {
        studyTitle,
        researchQuestion,
        theoreticalFramework,
        methodology,
        researchScope,
        mainClaim,
      };

      // Show 4-stage loader
      const steps = ANALYSIS_STEPS.map((s) => ({ ...s }));
      steps[0].status = "active";
      showLoading(
        "Risk Analiz Motorları Çalışıyor",
        "Yapay zeka asistanınız tez matrisinizi inceliyor, veri tabanlarını tarıyor ve risk raporunu hazırlıyor.",
        steps,
      );

      // ── Step 0: Extract queries ──
      const extractResult = await extractQueriesAction(matrixInput);
      if ("error" in extractResult) {
        hideLoading();
        toast.error(extractResult.error);
        setIsPending(false);
        return;
      }
      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");

      // ── Step 1: Execute parallel searches ──
      const searchResult = await executeSearchAction({
        studyTitle: matrixInput.studyTitle,
        tavilyQueries: extractResult.data.tavilyQueries,
        tezaraQueries: extractResult.data.tezaraQueries,
      });
      if ("error" in searchResult) {
        hideLoading();
        toast.error(searchResult.error);
        setIsPending(false);
        return;
      }
      updateLoadingStep(1, "completed");
      updateLoadingStep(2, "active");

      // ── Step 2: Sift theses ──
      const siftResult = await siftThesesAction({
        matrix: matrixInput,
        tezaraSearchResults: searchResult.data.tezaraSearchResults,
      });
      if ("error" in siftResult) {
        hideLoading();
        toast.error(siftResult.error);
        setIsPending(false);
        return;
      }
      updateLoadingStep(2, "completed");
      updateLoadingStep(3, "active");

      // ── Step 3: Finalize jury analysis ──
      const juryResult = await finalizeJuryAnalysisAction({
        matrix: matrixInput,
        scrapedTheses: siftResult.data,
        tavilyResults: searchResult.data.tavilyResults,
      });
      if ("error" in juryResult) {
        hideLoading();
        toast.error(juryResult.error);
        setIsPending(false);
        return;
      }
      updateLoadingStep(3, "completed");

      // Cache the completed report in Zustand so the risk page can pick it up
      // without re-running the analysis or hitting the DB.
      useOnboardingStore.getState().setReportData(juryResult.data);

      hideLoading();
      setIsPending(false);
      toast.success("Tez matrisi kaydedildi. Risk analizi tamamlandı.");
      router.push("/onboarding/risk");
    } catch (error) {
      hideLoading();
      console.error(error);
      const display = getErrorDisplay(error);
      toast.error(`${display.title}: ${display.description}`);
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
          <form onSubmit={handleConfirm} className="w-full space-y-6">
            <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="calismaBasligi"
                  className="block font-semibold text-foreground"
                >
                  Çalışma Başlığı
                </Label>
                <Textarea
                  id="calismaBasligi"
                  value={studyTitle}
                  onChange={(e) => setStudyTitle(e.target.value)}
                  required
                  className="textarea-academic"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="arastirmaSorusu"
                  className="block font-semibold text-foreground"
                >
                  Odak Sorular (Ana ve Alt Sorular)
                </Label>
                <Textarea
                  id="arastirmaSorusu"
                  value={researchQuestion}
                  onChange={(e) => setResearchQuestion(e.target.value)}
                  required
                  className="textarea-academic"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="kavramsalCerceve"
                  className="block font-semibold text-foreground"
                >
                  Teorik Altyapı, Kavramlar ve Yazarlar
                </Label>
                <Textarea
                  id="kavramsalCerceve"
                  value={theoreticalFramework}
                  onChange={(e) => setTheoreticalFramework(e.target.value)}
                  required
                  className="textarea-academic"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="metodoloji"
                  className="block font-semibold text-foreground"
                >
                  Veri Toplama ve Analiz Yöntemi
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
                  htmlFor="arastirmaKapsami"
                  className="block font-semibold text-foreground"
                >
                  Araştırma Sınırları (Zaman, Mekân, Aktör)
                </Label>
                <Textarea
                  id="arastirmaKapsami"
                  value={researchScope}
                  onChange={(e) => setResearchScope(e.target.value)}
                  required
                  className="textarea-academic"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="temelIddia"
                  className="block font-semibold text-foreground"
                >
                  Merkez Savı (Tezin Ana İddiası)
                </Label>
                <Textarea
                  id="temelIddia"
                  value={mainClaim}
                  onChange={(e) => setMainClaim(e.target.value)}
                  required
                  className="textarea-academic"
                />
              </div>
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
                    {loading ? "Yükleniyor..." : "Analiz devam ediyor..."}
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
