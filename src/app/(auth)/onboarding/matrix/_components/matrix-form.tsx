"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  Loader2,
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
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { saveThesisMatrixAction } from "../actions";
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
};

type SectionConfig = {
  id: string;
  title: string;
  fields: FieldConfig[];
};

/**
 * Matrisin 3 tematik bölümü ve her bölümdeki 2 alan tanımı.
 * Alan sıralaması akademik mantık akışını izler:
 * kimlik → çerçeve → kapsam ve iddia.
 */
const MATRIX_SECTIONS: SectionConfig[] = [
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
        placeholder: "Araştırmanızın mevcut veya geçici başlığını yazın...",
        hint: "Kesin başlık henüz belli değilse taslak bir ad belirtebilirsiniz.",
      },
      {
        key: "researchQuestion",
        id: "arastirmaSorusu",
        number: "02",
        Icon: HelpCircle,
        label: "Odak Sorular",
        placeholder: "Temel araştırma sorunuzu ve varsa alt soruları yazın...",
        hint: "'Neden' ve 'Nasıl' sorularınızı her satıra bir tane olacak şekilde yazabilirsiniz.",
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
        placeholder: "Kullanacağınız teoriler, okullar veya kurucu yazarlar...",
        hint: "Foucault'nun Söylem Analizi, Bourdieu'nün Alan Teorisi gibi. Birden fazlaysa virgülle ayırın.",
      },
      {
        key: "methodology",
        id: "metodoloji",
        number: "04",
        Icon: Layers,
        label: "Veri Toplama ve Analiz Yöntemi",
        placeholder: "Veriyi nasıl toplayacak ve analiz edeceksiniz?",
        hint: "Yarı yapılandırılmış mülakat, içerik analizi, anket gibi. Karma yöntemde her birini belirtin.",
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
        placeholder: "Zaman, mekân ve odaklanılan aktörleri tanımlayın...",
        hint: "Örn: 1990–2005, Doğu Avrupa, yerel yönetimler. Bu sınırların dışı kapsam dışıdır.",
      },
      {
        key: "mainClaim",
        id: "temelIddia",
        number: "06",
        Icon: Target,
        label: "Merkez Savı",
        placeholder:
          "Bu çalışmayla kanıtlamak istediğiniz temel iddianızı yazın...",
        hint: "Tüm çalışmanızı özetleyen tek bir cümle; literatüre kattığınız özgün katkı nedir?",
      },
    ],
  },
];

/**
 * MatrixForm — onboarding sürecinin 1. adımı.
 * Kullanıcının tez matrisini 6 alanlı 3 bölümlü akademik forma doldurmasını sağlar.
 * Veritabanına kaydeder ve risk analizi adımına yönlendirir.
 */
export function MatrixForm() {
  const router = useRouter();

  const [formState, setFormState] = useState<FormState>({
    studyTitle: "",
    researchQuestion: "",
    theoreticalFramework: "",
    methodology: "",
    researchScope: "",
    mainClaim: "",
  });
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const isLoading = useOnboardingStore((s) => s.isLoading);
  const hideLoading = useOnboardingStore((s) => s.hideLoading);

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
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        const display = getErrorDisplay(err);
        toast.error(`${display.title}: ${display.description}`);
      });
    return () => {
      cancelled = true;
      hideLoading();
    };
  }, [hideLoading]);

  /**
   * Form gönderimini yönetir. Tez matrisini doğrular ve veritabanına kaydeder.
   *
   * @param e - Form gönderme olayı.
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    try {
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

      // Tez değiştiğinde ileriki adımların önbelleğini temizle.
      const store = useOnboardingStore.getState();
      store.clearDownstreamData("matrix");
      store.setStepCompleted("matrix");

      toast.success("Tez matrisi başarıyla kaydedildi.");
      router.push("/onboarding/risk");
    } catch (error) {
      const display = getErrorDisplay(error);
      toast.error(`${display.title}: ${display.description}`);
      setIsPending(false);
    }
  };

  if (loading) {
    return <LoadingSpinner variant="card" />;
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-8">
      {MATRIX_SECTIONS.map((section) => (
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
            {section.fields.map(
              ({ key, id, number, Icon, label, placeholder, hint }) => (
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
                    rows={5}
                    className="textarea-academic border-border"
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {hint}
                  </p>
                </Card>
              ),
            )}
          </div>
        </div>
      ))}

      <div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isPending || isLoading}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            "Tez Anayasasını Kaydet"
          )}
        </Button>
      </div>
    </form>
  );
}
