"use client";

import { useState, useCallback, useMemo, memo } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  Loader2,
  ArrowRight,
  BookOpen,
  Compass,
  Target,
  Database,
} from "lucide-react";

import type { Matrix } from "@/core/db/schema";
import type { ThesisMatrix } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMatrixSubmit } from "../../_hooks/use-matrix-submit";

type FormState = {
  subjectProblem: string;
  theoreticalFramework: string;
  primaryMaterial: string;
  methodology: string;
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
    title: "Çalışma Odağı ve Kuramsal Altyapı",
    fields: [
      {
        key: "subjectProblem",
        id: "subjectProblem",
        number: "01",
        Icon: Target,
        label: "Araştırma Problemi, Aktörler ve Odak",
        description:
          "Neyi, hangi temel problemi çözmek veya hangi hipotezi test etmek için inceliyorsun? Hangi aktörleri, grupları, kurumları mercek altına alıyorsun? Bir araştırma konusu ile onu oluşturan aktörler birbirinden ayrıksı değildir.",
        placeholder:
          "Çalışmanızın araştırma problemini, odağını, incelediğiniz aktörleri/grupları/kurumları ve araştırma sorularınızı bütünleşik olarak detaylandırın...",
        rows: 5,
      },
      {
        key: "theoreticalFramework",
        id: "theoreticalFramework",
        number: "02",
        Icon: Compass,
        label: "Teorik ve Kavramsal Çerçeve",
        description:
          "Çalışmanı hangi teorik mercekle, modelle veya kavramsal yaklaşımla ele alıyorsun?",
        placeholder:
          "Temel aldığınız teorik merceği, kavramsal modelleri ve analitik yaklaşımınızı açıklayın...",
        rows: 4,
      },
    ],
  },
  {
    id: "veriVeYontem",
    title: "Veri Kaynağı ve Yöntem",
    fields: [
      {
        key: "primaryMaterial",
        id: "primaryMaterial",
        number: "03",
        Icon: Database,
        label: "Veri Kaynağı / Birincil Malzeme",
        description:
          "Hangi birincil kaynakları, veri setlerini veya arşiv malzemelerini kullanacaksın? (mülakat, anket, gazete, arşiv belgeleri, mahkeme kararları vb.)",
        placeholder:
          "Kullanacağınız veri kaynaklarını, birincil malzemeleri veya arşiv belgelerini tanımlayın...",
        rows: 4,
      },
      {
        key: "methodology",
        id: "methodology",
        number: "04",
        Icon: BookOpen,
        label: "Metodoloji",
        description:
          "Veriyi nasıl topluyor, işliyor veya ölçüyorsun? (Nitel, nicel, deneysel, simülasyon vb.)",
        placeholder:
          "Veri toplama, veri işleme ve analiz yöntemlerinizi (nitel/nicel/deneysel/simülasyon) ve temel argümanınızı açıklayın...",
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
  description: string;
  placeholder: string;
  value: string;
  rows: number;
  onChange: (key: keyof FormState, value: string) => void;
}

/**
 * A memoized form card containing a single text area field to limit re-renders.
 *
 * @param root0 - The matrix card props.
 * @param root0.fieldKey - The form state key bound to the text area.
 * @param root0.id - The field id used for label and text area association.
 * @param root0.number - The numbered badge shown on the card.
 * @param root0.Icon - The icon rendered next to the label.
 * @param root0.label - The field label.
 * @param root0.description - The helper description shown below the label.
 * @param root0.placeholder - The text area placeholder text.
 * @param root0.value - The current text area value.
 * @param root0.rows - The text area row count.
 * @param root0.onChange - The change handler receiving the field key and the new value.
 * @returns The rendered matrix card.
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
    <Card className="space-y-3 p-6 hover:border-primary/20 rounded-md transition-all">
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

const EMPTY_VALUES: FormState = {
  subjectProblem: "",
  theoreticalFramework: "",
  primaryMaterial: "",
  methodology: "",
};

interface MatrixFormProps {
  initialMatrix?: Matrix | null;
}

/**
 * Renders the thesis matrix onboarding form and persists the submitted values to the database.
 *
 * @param root0 - The matrix form props.
 * @param root0.initialMatrix - Pre-fetched thesis matrix data (nullable).
 * @returns The rendered matrix form.
 */
export function MatrixForm({ initialMatrix }: MatrixFormProps) {
  const { submitMatrix } = useMatrixSubmit();

  const [isPending, setIsPending] = useState(false);
  const [editedValues, setEditedValues] = useState<Partial<FormState>>({});

  const formState = useMemo((): FormState => {
    const base = initialMatrix ?? EMPTY_VALUES;
    return {
      subjectProblem: editedValues.subjectProblem ?? base.subjectProblem,
      theoreticalFramework:
        editedValues.theoreticalFramework ?? base.theoreticalFramework,
      primaryMaterial:
        editedValues.primaryMaterial ?? base.primaryMaterial ?? "",
      methodology: editedValues.methodology ?? base.methodology,
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
        subjectProblem: formState.subjectProblem,
        theoreticalFramework: formState.theoreticalFramework,
        primaryMaterial: formState.primaryMaterial,
        methodology: formState.methodology,
      } as ThesisMatrix);
    } catch {
      toast.error(
        "Matris kaydedilirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
      );
    } finally {
      setIsPending(false);
    }
  };

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
              Onayla ve Konumlandırma Adımına Geç
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}
