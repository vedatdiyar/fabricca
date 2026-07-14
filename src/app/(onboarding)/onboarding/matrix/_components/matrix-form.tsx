"use client";

import { useState, useCallback, useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { useOnboardingNavigation } from "../../_hooks/use-onboarding-navigation";
import { fetchThesisMatrixFresh } from "../../_services/fetch-actions";

type FormState = {
  mainActors: string;
  researchFocus: string;
  temporalScope: string;
  spatialScope: string;
  theoreticalFramework: string;
  methodology: string;
  mainClaim: string;
};

type FieldConfig = {
  key: keyof FormState;
  id: string;
  number: string;
  Icon: LucideIcon;
  label: string;
  placeholder: string;
  rows: number;
};

type SectionConfig = {
  id: string;
  title: string;
  fields: FieldConfig[];
};

const MATRIX_SECTIONS: SectionConfig[] = [
  {
    id: "odakVeAktorler",
    title: "Odak ve Aktörler",
    fields: [
      {
        key: "mainActors",
        id: "anaAktorler",
        number: "01",
        Icon: FileText,
        label: "Ana Aktörler / Kurumlar / Özneler",
        placeholder:
          "Araştırma kapsamında odaklanılan aktörler, gruplar, kurum veya kuruluşlar... (örn. sivil toplum kuruluşları, kamu kurumları, özel sektör aktörleri vb.)",
        rows: 3,
      },
      {
        key: "researchFocus",
        id: "arastirmaProblemi",
        number: "02",
        Icon: HelpCircle,
        label: "Araştırma Problemi / Konu Odağı",
        placeholder:
          "İncelediğiniz temel problem, araştırma sorusu veya odaklanılan olgu/kavram...",
        rows: 4,
      },
    ],
  },
  {
    id: "kapsamVeBaglam",
    title: "Kapsam ve Bağlam",
    fields: [
      {
        key: "temporalScope",
        id: "zamanDilimi",
        number: "03",
        Icon: Compass,
        label: "Zaman Dilimi / Dönem",
        placeholder:
          "Araştırmanın sınırlandırıldığı kronolojik dönem (örn. belirli bir yıl aralığı, on yıl veya dönem)...",
        rows: 2,
      },
      {
        key: "spatialScope",
        id: "mekansalBaglam",
        number: "04",
        Icon: Compass,
        label: "Mekânsal Bağlam / Coğrafya",
        placeholder:
          "Araştırmanın gerçekleştiği coğrafi/mekânsal sınırlar veya inceleme birimi (örn. bir ülke, bölge, kurum veya yayın organı)...",
        rows: 2,
      },
    ],
  },
  {
    id: "kuramYontemSav",
    title: "Kuram, Yöntem ve Sav",
    fields: [
      {
        key: "theoreticalFramework",
        id: "kavramsalCerceve",
        number: "05",
        Icon: BookMarked,
        label: "Kuramsal Çerçeve ve Kurucu Yazarlar",
        placeholder:
          "Kullanacağınız teoriler, kavramsal modeller ve ilgili kuramcılar...",
        rows: 4,
      },
      {
        key: "methodology",
        id: "metodoloji",
        number: "06",
        Icon: Layers,
        label: "Veri Toplama ve Analiz Yöntemi",
        placeholder:
          "Kullanacağınız yöntem ve analiz araçları (örn. nitel/nicel içerik analizi, mülakat, anket, deneysel yöntem)...",
        rows: 4,
      },
      {
        key: "mainClaim",
        id: "temelIddia",
        number: "07",
        Icon: Target,
        label: "Merkez Savı / Temel İddia",
        placeholder:
          "Bu çalışmayla kanıtlamak istediğiniz temel savınız/hipoteziniz...",
        rows: 4,
      },
    ],
  },
];

interface MatrixCardProps {
  fieldKey: keyof FormState;
  id: string;
  number: string;
  Icon: LucideIcon;
  label: string;
  placeholder: string;
  value: string;
  rows: number;
  onChange: (key: keyof FormState, value: string) => void;
}

/**
 * A memoized form card containing a single text area field to limit re-renders.
 */
const MatrixCard = memo(function MatrixCard({
  fieldKey,
  id,
  number,
  Icon,
  label,
  placeholder,
  value,
  rows,
  onChange,
}: MatrixCardProps) {
  return (
    <Card className="space-y-2 p-4 hover:border-primary/20 rounded-md">
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
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        required
        rows={rows}
        className="textarea-academic border-border"
      />
    </Card>
  );
});

/**
 * MatrixForm — onboarding step 1. Renders the thesis matrix as a 7-field,
 * 3-section academic form. Persists to the database and navigates to the risk
 * analysis step.
 */
const EMPTY_VALUES: FormState = {
  mainActors: "",
  researchFocus: "",
  temporalScope: "",
  spatialScope: "",
  theoreticalFramework: "",
  methodology: "",
  mainClaim: "",
};

export function MatrixForm() {
  const { submitMatrix } = useOnboardingNavigation();

  const [isPending, setIsPending] = useState(false);
  const [editedValues, setEditedValues] = useState<Partial<FormState>>({});

  const {
    data: initialMatrix,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["thesis-matrix"],
    queryFn: fetchThesisMatrixFresh,
    staleTime: 0,
  });

  const formState = useMemo((): FormState => {
    const base = initialMatrix ?? EMPTY_VALUES;
    return {
      mainActors: editedValues.mainActors ?? base.mainActors,
      researchFocus: editedValues.researchFocus ?? base.researchFocus,
      temporalScope: editedValues.temporalScope ?? base.temporalScope,
      spatialScope: editedValues.spatialScope ?? base.spatialScope,
      theoreticalFramework:
        editedValues.theoreticalFramework ?? base.theoreticalFramework,
      methodology: editedValues.methodology ?? base.methodology,
      mainClaim: editedValues.mainClaim ?? base.mainClaim,
    };
  }, [initialMatrix, editedValues]);

  const handleFieldChange = useCallback(
    (key: keyof FormState, value: string) => {
      setEditedValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setIsPending(true);

    try {
      await submitMatrix({
        mainActors: formState.mainActors,
        researchFocus: formState.researchFocus,
        theoreticalFramework: formState.theoreticalFramework,
        methodology: formState.methodology,
        temporalScope: formState.temporalScope,
        spatialScope: formState.spatialScope,
        mainClaim: formState.mainClaim,
      });
    } catch (error) {
      const display = getErrorDisplay(error);
      toast.error(`${display.title}: ${display.description}`);
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner variant="card" />;
  }

  if (error) {
    const display = getErrorDisplay(error);
    return (
      <div className="text-destructive text-center py-8">
        {display.title}: {display.description}
      </div>
    );
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
                <MatrixCard
                  key={id}
                  fieldKey={key}
                  id={id}
                  number={number}
                  Icon={Icon}
                  label={label}
                  placeholder={placeholder}
                  value={formState[key]}
                  rows={rows}
                  onChange={handleFieldChange}
                />
              ),
            )}
          </div>
        </div>
      ))}

      <div className="flex justify-end mt-8 pb-8">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Table className="w-4 h-4" />
              Matrisi Onayla ve Risk Analizine Geç
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}
