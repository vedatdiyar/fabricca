"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  Loader2,
  Sparkles,
  FileText,
  HelpCircle,
  BookMarked,
  Layers,
  Compass,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

type FormState = {
  studyTitle: string;
  researchQuestion: string;
  theoreticalFramework: string;
  methodology: string;
  researchScope: string;
  mainClaim: string;
};

type FieldConfig = {
  key: keyof FormState;
  id: string;
  number: string;
  Icon: LucideIcon;
  label: string;
  hint: string;
};

type SectionConfig = {
  id: string;
  title: string;
  fields: FieldConfig[];
};

/**
 * Enrichment adımının alan tanımları. Matrix adımıyla aynı 3 bölüm yapısını kullanır;
 * ipucu metinleri kullanıcı girdisi yerine yapay zekanın ne yaptığını açıklar.
 */
const ENRICHMENT_SECTIONS: SectionConfig[] = [
  {
    id: "arastirmaSorusu",
    title: "Araştırma Sorusu",
    fields: [
      {
        key: "studyTitle",
        id: "calismaBasligi",
        number: "01",
        Icon: FileText,
        label: "Çalışma Başlığı",
        hint: "Başlığınız akademik normlar doğrultusunda sadeleştirildi.",
      },
      {
        key: "researchQuestion",
        id: "arastirmaSorusu",
        number: "02",
        Icon: HelpCircle,
        label: "Odak Sorular",
        hint: "Odak sorular analitik ve hiyerarşik bir yapıya kavuştu.",
      },
    ],
  },
  {
    id: "kuramlCerceve",
    title: "Kuramsal Çerçeve",
    fields: [
      {
        key: "theoreticalFramework",
        id: "kavramsalCerceve",
        number: "03",
        Icon: BookMarked,
        label: "Teorik Altyapı ve Yazarlar",
        hint: "Kuramsal referanslar ve kavramlar sistematize edildi.",
      },
      {
        key: "methodology",
        id: "metodoloji",
        number: "04",
        Icon: Layers,
        label: "Veri Toplama ve Analiz Yöntemi",
        hint: "Metodoloji daha belirgin ve akademik bir dille ifade edildi.",
      },
    ],
  },
  {
    id: "sinirlarIddia",
    title: "Sınırlar ve İddia",
    fields: [
      {
        key: "researchScope",
        id: "arastirmaKapsami",
        number: "05",
        Icon: Compass,
        label: "Araştırma Sınırları",
        hint: "Zaman, mekân ve aktör sınırları netleştirildi.",
      },
      {
        key: "mainClaim",
        id: "temelIddia",
        number: "06",
        Icon: Target,
        label: "Merkez Savı",
        hint: "İddia daha net, sınanabilir ve akademik bir forma getirildi.",
      },
    ],
  },
];

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
 * EnrichmentView — onboarding sürecinin 2. adımı.
 * Kullanıcının yapay zeka tarafından zenginleştirilmiş tez matrisini incelemesini,
 * düzenlemesini ve onaylamasını sağlar. Onay sonrasında 4 aşamalı risk analizi
 * pipeline'ını (Tavily, Tezara, Jüri Analizi) arka planda koşturur.
 */
export function EnrichmentView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);

  const [formState, setFormState] = useState<FormState>({
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
   * Form onaylandığında tetiklenir. Düzenlenen tez matrisini kaydeder ve
   * risk analizi motorlarını (Tavily, Tezara, Jüri Analizi) sırasıyla çalıştırır.
   *
   * @param e - Form gönderme olayı.
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

      // Eski downstream Zustand state'ini temizle.
      setBoxes(null);
      setLiteraturePool([]);
      useOnboardingStore.getState().clearReportData();

      const matrixInput = {
        studyTitle: formState.studyTitle,
        researchQuestion: formState.researchQuestion,
        theoreticalFramework: formState.theoreticalFramework,
        methodology: formState.methodology,
        researchScope: formState.researchScope,
        mainClaim: formState.mainClaim,
      };

      // 4 aşamalı yükleme spinner'ını başlat.
      const steps = ANALYSIS_STEPS.map((s) => ({ ...s }));
      steps[0].status = "active";
      showLoading(
        "Risk Analiz Motorları Çalışıyor",
        "Yapay zeka asistanınız tez matrisinizi inceliyor, veri tabanlarını tarıyor ve risk raporunu hazırlıyor.",
        steps,
      );

      // ── Adım 0: Sorguları çıkar ──
      const extractResult = await extractQueriesAction(matrixInput);
      if ("error" in extractResult) {
        hideLoading();
        toast.error(extractResult.error);
        setIsPending(false);
        return;
      }
      updateLoadingStep(0, "completed");
      updateLoadingStep(1, "active");

      // ── Adım 1: Paralel arama motorlarını çalıştır ──
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

      // ── Adım 2: Tezleri filtrele ──
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

      // ── Adım 3: Jüri analizini tamamla ──
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

      // Tamamlanan raporu Zustand'a yaz; risk sayfası buradan okur.
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
    <form onSubmit={handleConfirm} className="w-full space-y-8">
      {/* AI zenginleştirme bildirimi */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">
            Yapay Zeka Zenginleştirmesi Tamamlandı
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Tez matrisiniz akademik dile uyarlandı. Her alanı inceleyip
            düzenleyebilir, ardından onaylayabilirsiniz.
          </p>
        </div>
      </div>

      {ENRICHMENT_SECTIONS.map((section) => (
        <div key={section.id} className="space-y-5">
          {/* Bölüm başlığı — iki yanda divider çizgisi */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.title}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* İki sütunlu alan grid'i */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {section.fields.map(({ key, id, number, Icon, label, hint }) => (
              <MatrixField
                key={id}
                id={id}
                number={number}
                Icon={Icon}
                label={label}
                hint={hint}
                value={formState[key]}
                onChange={(value) =>
                  setFormState((prev) => ({ ...prev, [key]: value }))
                }
              />
            ))}
          </div>
        </div>
      ))}

      <div>
        <Button
          type="submit"
          className="btn-academic-hero w-full"
          disabled={isPending}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analiz devam ediyor...
            </span>
          ) : (
            "Onayla ve İlerle"
          )}
        </Button>
      </div>
    </form>
  );
}
