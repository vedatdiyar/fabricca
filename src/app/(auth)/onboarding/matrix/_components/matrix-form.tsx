"use client";

import { useState, useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Loader2,
  Table,
  FileText,
  HelpCircle,
  BookMarked,
  Layers,
  Compass,
  Target,
} from "lucide-react";

import { getErrorDisplay } from "@/lib/error-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  useLoadingOverlay,
  type LoadingStep,
} from "@/components/providers/loading-overlay-provider";
import { saveThesisMatrixAction } from "../actions";
import { clearDownstreamDbAction } from "@/app/(auth)/onboarding/actions";
import { fetchThesisMatrix } from "../../_lib/fetch-actions";

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
  placeholder: string;
  hint: string;
  rows: number;
};

type SectionConfig = {
  id: string;
  title: string;
  fields: FieldConfig[];
};

const MATRIX_SECTIONS: SectionConfig[] = [
  {
    id: "arastirmaSorusu",
    title: "Ara\u015ftırma Sorusu",
    fields: [
      {
        key: "studyTitle",
        id: "calismaBasligi",
        number: "01",
        Icon: FileText,
        label: "\u00c7alışma Başlığı",
        placeholder: "Araştırmanızın mevcut veya geçici başlığını yazın...",
        hint: "",
        rows: 2,
      },
      {
        key: "researchQuestion",
        id: "arastirmaSorusu",
        number: "02",
        Icon: HelpCircle,
        label: "Odak Sorular",
        placeholder: "Temel araştırma sorunuzu ve varsa alt soruları yazın...",
        hint: "",
        rows: 5,
      },
    ],
  },
  {
    id: "kuramlCerceve",
    title: "Kuramsal \u00c7erçeve",
    fields: [
      {
        key: "theoreticalFramework",
        id: "kavramsalCerceve",
        number: "03",
        Icon: BookMarked,
        label: "Teorik Altyapı ve Yazarlar",
        placeholder: "Kullanacağınız teoriler, okullar veya kurucu yazarlar...",
        hint: "",
        rows: 5,
      },
      {
        key: "methodology",
        id: "metodoloji",
        number: "04",
        Icon: Layers,
        label: "Veri Toplama ve Analiz Yöntemi",
        placeholder: "Veriyi nasıl toplayacak ve analiz edeceksiniz?",
        hint: "",
        rows: 5,
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
        label: "Ara\u015ftırma Sınırları",
        placeholder: "Zaman, mekân ve odaklanılan aktörleri tanımlayın...",
        hint: "",
        rows: 5,
      },
      {
        key: "mainClaim",
        id: "temelIddia",
        number: "06",
        Icon: Target,
        label: "Merkez Savı",
        placeholder:
          "Bu çalışmayla kanıtlamak istediğiniz temel iddianızı yazın...",
        hint: "",
        rows: 5,
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
 * MatrixForm — onboarding sürecinin 1. adımı.
 * Kullanıcının tez matrisini 6 alanlı 3 bölümlü akademik forma doldurmasını sağlar.
 * Veritabanına kaydeder ve risk analizi adımına yönlendirir.
 */
export function MatrixForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formState, setFormState] = useState<FormState>({
    studyTitle: "",
    researchQuestion: "",
    theoreticalFramework: "",
    methodology: "",
    researchScope: "",
    mainClaim: "",
  });
  const [isPending, setIsPending] = useState(false);

  const [loadState, dispatch] = useReducer(
    (_state: { loading: boolean }, action: { type: "done" | "error" }) => {
      switch (action.type) {
        case "done":
        case "error":
          return { loading: false };
      }
    },
    { loading: true },
  );

  const { isLoading, showLoading } = useLoadingOverlay();

  useEffect(() => {
    let cancelled = false;
    fetchThesisMatrix()
      .then((matrix) => {
        if (cancelled) return;
        if (matrix) {
          setFormState({
            studyTitle: matrix.studyTitle,
            researchQuestion: matrix.researchQuestion,
            theoreticalFramework: matrix.theoreticalFramework,
            methodology: matrix.methodology,
            researchScope: matrix.researchScope,
            mainClaim: matrix.mainClaim,
          });
        }
        dispatch({ type: "done" });
      })
      .catch((err) => {
        if (cancelled) return;
        dispatch({ type: "error" });
        const display = getErrorDisplay(err);
        toast.error(`${display.title}: ${display.description}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    try {
      // Purge downstream data before anything else so the risk page
      // does not see stale reports and skip re-analysis.
      const clearResult = await clearDownstreamDbAction("matrix");
      if ("error" in clearResult) {
        toast.error(clearResult.error);
        setIsPending(false);
        return;
      }
      await queryClient.invalidateQueries();

      const result = await saveThesisMatrixAction({
        studyTitle: formState.studyTitle,
        researchQuestion: formState.researchQuestion,
        theoreticalFramework: formState.theoreticalFramework,
        methodology: formState.methodology,
        researchScope: formState.researchScope,
        mainClaim: formState.mainClaim,
      });

      if ("error" in result) {
        toast.error(result.error);
        setIsPending(false);
        return;
      }

      toast.success("Tez matrisi başarıyla kaydedildi.");

      // Show the loading overlay immediately and clear stale caches so the
      // risk page starts fresh — the auto-trigger effect will pick up from
      // the already-visible overlay.
      showLoading(
        "Risk Analiz Motorları Çalışıyor",
        "Yapay zeka asistanınız tez matrisinizi inceliyor, veri tabanlarını tarıyor ve risk raporunu hazırlıyor.",
        ANALYSIS_STEPS,
      );
      queryClient.removeQueries({ queryKey: ["originalityReport"] });
      queryClient.setQueryData(["reanalyze"], true);
      router.push("/onboarding/risk");
    } catch (error) {
      const display = getErrorDisplay(error);
      toast.error(`${display.title}: ${display.description}`);
      setIsPending(false);
    } finally {
      setIsPending(false);
    }
  };

  if (loadState.loading) {
    return <LoadingSpinner variant="card" />;
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-8">
      {MATRIX_SECTIONS.map((section) => (
        <div key={section.id} className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.title}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {section.fields.map(
              ({ key, id, number, Icon, label, placeholder, rows }) => (
                <Card
                  key={id}
                  className="space-y-2 p-4 hover:border-primary/20 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-7 items-center justify-center rounded bg-primary/10 text-[10px] font-bold tracking-wider text-primary">
                      {number}
                    </span>
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label
                      htmlFor={id}
                      className="cursor-pointer text-sm font-semibold text-foreground"
                    >
                      {label}
                    </Label>
                  </div>
                  <Textarea
                    id={id}
                    placeholder={placeholder}
                    value={formState[key]}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    required
                    rows={rows}
                    className="textarea-academic border-border"
                  />
                </Card>
              ),
            )}
          </div>
        </div>
      ))}

      <div className="flex justify-end mt-8 pb-8">
        <Button type="submit" size="lg" disabled={isPending || isLoading}>
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Table className="w-4 h-4" />
              Tez Matrisini Onayla ve Risk Analizine Geç
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}
