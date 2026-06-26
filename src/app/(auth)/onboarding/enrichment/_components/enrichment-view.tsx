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
import { AIBanner } from "@/components/ai-banner";
import { confirmEnhancedThesisAction } from "../actions";
import { fetchThesisMatrix } from "../../_lib/fetch-actions";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { useOnboardingNavigation } from "../../_hooks/use-onboarding-navigation";
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

/**
 * EnrichmentView — onboarding sürecinin 2. adımı.
 * Kullanıcının yapay zeka tarafından zenginleştirilmiş tez matrisini incelemesini,
 * düzenlemesini ve onaylamasını sağlar. Onay sonrasında risk analizi pipeline'ını
 * merkezi onboarding orkestratörü aracılığıyla çalıştırır.
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

  const { runRiskPipeline } = useOnboardingNavigation();

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
   * risk analizi pipeline'ını merkezi orkestratör üzerinden çalıştırır.
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
      useOnboardingStore.getState().clearDownstreamData("enrichment");
      useOnboardingStore.getState().setStepCompleted("enrichment");

      const matrixInput = {
        studyTitle: formState.studyTitle,
        researchQuestion: formState.researchQuestion,
        theoreticalFramework: formState.theoreticalFramework,
        methodology: formState.methodology,
        researchScope: formState.researchScope,
        mainClaim: formState.mainClaim,
      };

      // Risk pipeline'ını orkestratör üzerinden çalıştır
      const pipelineResult = await runRiskPipeline(matrixInput);
      if (pipelineResult.error) {
        toast.error(pipelineResult.error);
        setIsPending(false);
        return;
      }

      // Tamamlanan raporu Zustand'a yaz; risk sayfası buradan okur.
      useOnboardingStore.getState().setReportData(pipelineResult.data!);
      useOnboardingStore.getState().setStepCompleted("risk");

      setIsPending(false);
      toast.success("Tez matrisi kaydedildi. Risk analizi tamamlandı.");
      router.push("/onboarding/risk");
    } catch (error) {
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
      <AIBanner
        icon={Sparkles}
        title="Yapay Zeka Zenginleştirmesi Tamamlandı"
        description="Tez matrisiniz akademik dile uyarlandı. Her alanı inceleyip düzenleyebilir, ardından onaylayabilirsiniz."
      />

      {ENRICHMENT_SECTIONS.map((section) => (
        <div key={section.id} className="space-y-6">
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
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
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
