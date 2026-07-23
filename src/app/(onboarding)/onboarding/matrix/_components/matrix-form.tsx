"use client";

import { useState, useCallback, useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  Loader2,
  Table,
  BookOpen,
  Boxes,
  Compass,
  MapPin,
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
  researchCore: string;
  targetActors: string;
  context: string;
  framework: string;
  mainClaim: string;
};

type FieldConfig = {
  key: keyof FormState;
  id: string;
  number: string;
  Icon: LucideIcon;
  label: string;
  description: string;
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
    id: "odakVeTeori",
    title: "Çalışma Odağı ve Teorik Altyapı",
    fields: [
      {
        key: "researchCore",
        id: "researchCore",
        number: "01",
        Icon: Target,
        label: "Çalışmanın Odağı & Problemi",
        description:
          "Neyi, hangi temel problemi çözmek veya hangi hipotezi test etmek için inceliyorsun?",
        placeholder:
          "Çalışmanızın odağını, çözmeyi hedeflediğiniz temel problemi ve araştırma sorularınızı detaylandırın...",
        rows: 4,
      },
      {
        key: "framework",
        id: "framework",
        number: "02",
        Icon: Compass,
        label: "Teorik / Kavramsal Çerçeve",
        description:
          "Çalışmanı hangi teorik mercekle, modelle veya kavramsal yaklaşımla ele alıyorsun?",
        placeholder:
          "Temel aldığınız teorik merceği, kavramsal modelleri ve analitik yaklaşımınızı açıklayın...",
        rows: 4,
      },
    ],
  },
  {
    id: "analizYontemKapsam",
    title: "Analiz Birimi, Metodoloji ve Kapsam Sınırları",
    fields: [
      {
        key: "targetActors",
        id: "targetActors",
        number: "03",
        Icon: Boxes,
        label: "Analiz Birimi / Aktörler / Odak Nesne",
        description:
          "Veriyi nereden topluyorsun? Kimi, hangi veri kümesini, materyali veya aktörleri inceliyorsun?",
        placeholder:
          "İncelediğiniz aktörleri, veri setlerini, materyalleri veya odak nesnelerinizi tanımlayın...",
        rows: 3,
      },
      {
        key: "mainClaim",
        id: "mainClaim",
        number: "04",
        Icon: BookOpen,
        label: "Metodoloji & Yöntem",
        description:
          "Veriyi nasıl topluyor, işliyor veya ölçüyorsun? (Nitel, nicel, deneysel, simülasyon vb.)",
        placeholder:
          "Veri toplama, veri işleme ve analiz yöntemlerinizi (nitel/nicel/deneysel/simülasyon) ve temel argümanınızı açıklayın...",
        rows: 3,
      },
      {
        key: "context",
        id: "context",
        number: "05",
        Icon: MapPin,
        label: "Kapsam & Sınırlar",
        description:
          "Çalışmanın zaman, mekan, sektör, örneklem veya coğrafi sınırları nedir?",
        placeholder:
          "Çalışmanızın dönemsel, coğrafi, sektörel veya örneklem sınırlarını belirtin...",
        rows: 3,
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
  description: string;
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
  description,
  placeholder,
  value,
  rows,
  onChange,
}: MatrixCardProps) {
  return (
    <Card className="space-y-3 p-4 hover:border-primary/20 rounded-md transition-all shadow-xs">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-7 items-center justify-center rounded bg-primary/10 text-[10px] font-bold tracking-wider text-primary">
            {number}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <Label
            htmlFor={id}
            className="cursor-pointer text-sm font-semibold text-foreground"
          >
            {label}
          </Label>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground pl-9 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <Textarea
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        required
        rows={rows}
        className="textarea-academic border-border focus-visible:ring-primary/20 text-sm leading-relaxed"
      />
    </Card>
  );
});

/**
 * MatrixForm — onboarding step 1. Renders the thesis matrix as a 5-field,
 * 2-section academic form. Persists to the database and navigates to the risk
 * analysis step.
 */
const EMPTY_VALUES: FormState = {
  researchCore: "",
  targetActors: "",
  context: "",
  framework: "",
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
      researchCore: editedValues.researchCore ?? base.researchCore,
      targetActors: editedValues.targetActors ?? base.targetActors,
      context: editedValues.context ?? base.context,
      framework: editedValues.framework ?? base.framework,
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
        researchCore: formState.researchCore,
        targetActors: formState.targetActors,
        context: formState.context,
        framework: formState.framework,
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
              ({
                key,
                id,
                number,
                Icon,
                label,
                description,
                placeholder,
                rows,
              }) => (
                <MatrixCard
                  key={id}
                  fieldKey={key}
                  id={id}
                  number={number}
                  Icon={Icon}
                  label={label}
                  description={description}
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
