"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { MatrixField } from "./matrix-field";
import { EnrichmentLoadingSkeleton } from "./enrichment-loading-skeleton";

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

/**
 * Onboarding sürecinin 2. adımı olan Akademik Zenginleştirme İnceleme Ekranı.
 * Kullanıcının zenginleştirilmiş tez matrisini incelemesini, düzenlemesini,
 * onaylamasını ve ardından arka planda risk analizi motorlarının koşturulmasını yönetir.
 */
export function EnrichmentView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);

  const [formState, setFormState] = useState({
    studyTitle: "",
    researchQuestion: "",
    theoreticalFramework: "",
    methodology: "",
    researchScope: "",
    mainClaim: "",
  });

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
      setFormState({
        studyTitle: matrix.studyTitle,
        researchQuestion: matrix.researchQuestion,
        theoreticalFramework: matrix.theoreticalFramework,
        methodology: matrix.methodology,
        researchScope: matrix.researchScope,
        mainClaim: matrix.mainClaim,
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  /**
   * Form onaylandığında tetiklenir. Düzenlenen tez matrisini kaydeder
   * ve risk analizi motorlarını (Tavily, Tezara, Jüri Analizi) sırasıyla çalıştırır.
   *
   * @param e Form gönderme olayı.
   */
  const handleConfirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    const data: EnhancedThesisData = {
      studyTitle: formState.studyTitle,
      researchQuestion: formState.researchQuestion,
      theoreticalFramework: formState.theoreticalFramework,
      methodology: formState.methodology,
      researchScope: formState.researchScope,
      mainClaim: formState.mainClaim,
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
        studyTitle: formState.studyTitle,
        researchQuestion: formState.researchQuestion,
        theoreticalFramework: formState.theoreticalFramework,
        methodology: formState.methodology,
        researchScope: formState.researchScope,
        mainClaim: formState.mainClaim,
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
    return <EnrichmentLoadingSkeleton />;
  }

  return (
    <>
      <Card className="w-full pt-6">
        <CardContent>
          <form onSubmit={handleConfirm} className="w-full space-y-6">
            <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
              <MatrixField
                id="calismaBasligi"
                label="Çalışma Başlığı"
                value={formState.studyTitle}
                onChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    studyTitle: value,
                  }))
                }
              />
              <MatrixField
                id="arastirmaSorusu"
                label="Odak Sorular (Ana ve Alt Sorular)"
                value={formState.researchQuestion}
                onChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    researchQuestion: value,
                  }))
                }
              />
              <MatrixField
                id="kavramsalCerceve"
                label="Teorik Altyapı, Kavramlar ve Yazarlar"
                value={formState.theoreticalFramework}
                onChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    theoreticalFramework: value,
                  }))
                }
              />
              <MatrixField
                id="metodoloji"
                label="Veri Toplama ve Analiz Yöntemi"
                value={formState.methodology}
                onChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    methodology: value,
                  }))
                }
              />
              <MatrixField
                id="arastirmaKapsami"
                label="Araştırma Sınırları (Zaman, Mekân, Aktör)"
                value={formState.researchScope}
                onChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    researchScope: value,
                  }))
                }
              />
              <MatrixField
                id="temelIddia"
                label="Merkez Savı (Tezin Ana İddiası)"
                value={formState.mainClaim}
                onChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    mainClaim: value,
                  }))
                }
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
