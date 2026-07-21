"use client";

import { useState, useCallback, useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { Loader2, Table, BookMarked, Globe, Target } from "lucide-react";

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
    id: "arastirmaOdagi",
    title: "Araştırma Odağı",
    fields: [
      {
        key: "researchCore",
        id: "researchCore",
        number: "01",
        Icon: Target,
        label: "Araştırma Konusu ve Soruları",
        placeholder:
          "Araştırmanızın temel konusu, kavramsal/teorik problemi ve cevap aradığı temel sorular (örn: Kürt hareketinin söylemsel dönüşümünü tetikleyen sol ilişkiler nelerdir?)...",
        rows: 4,
      },
      {
        key: "targetActors",
        id: "targetActors",
        number: "02",
        Icon: Target,
        label: "Aktörler ve Odak Gruplar",
        placeholder:
          "Araştırmanızda odaklanılan ana aktörler, özneler, kurumlar veya toplumsal gruplar (örn: PKK, DEP, HADEP ve Türkiye sosyalist sol partileri)...",
        rows: 3,
      },
    ],
  },
  {
    id: "baglamVeYontem",
    title: "Bağlam ve Çerçeve",
    fields: [
      {
        key: "context",
        id: "context",
        number: "03",
        Icon: Globe,
        label: "Tarihsel ve Coğrafi Bağlam",
        placeholder:
          "Araştırmanın geçtiği yer, dönem ve bu dönemi önemli kılan tarihsel/yapısal gelişmeler (örn: 1991-1999 dönemi Türkiye'si, Sovyetlerin dağılması ve zorunlu göçler)...",
        rows: 3,
      },
      {
        key: "framework",
        id: "framework",
        number: "04",
        Icon: BookMarked,
        label: "Kuramsal ve Metodolojik Çerçeve",
        placeholder:
          "Araştırmada kullanılan teoriler, yöntemler ve veri kaynakları (örn: Gramsci hegemonya teorisi ve süreli yayınların söylem analizi, mülakatlar)...",
        rows: 3,
      },
    ],
  },
  {
    id: "sav",
    title: "Tezin İddiası",
    fields: [
      {
        key: "mainClaim",
        id: "mainClaim",
        number: "05",
        Icon: Target,
        label: "Merkez Sav ve Ana İddia",
        placeholder:
          "Bu çalışmayla savunacağınız temel tez, hipotez veya ana nedensellik argümanınız...",
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
 * MatrixForm — onboarding step 1. Renders the thesis matrix as a 5-field,
 * 3-section academic form. Persists to the database and navigates to the risk
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
