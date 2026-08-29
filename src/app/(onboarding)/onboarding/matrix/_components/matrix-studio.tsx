"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Target,
  Compass,
  Database,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AIBanner } from "@/components/shared/ai-banner";
import type { ThesisMatrix } from "@/lib/types";
import { useMatrixSubmit } from "@/app/(onboarding)/onboarding/_hooks/use-matrix-submit";

interface MatrixStudioProps {
  initialMatrix?: {
    id?: number;
    subjectProblem?: string;
    theoreticalFramework?: string;
    primaryMaterial?: string | null;
    methodology?: string;
  } | null;
}

/**
 * Onboarding Step 2: 4-Quadrant Academic Thesis Matrix review, editing, and confirmation studio.
 *
 * @param props - Initial matrix data from DB.
 * @returns The rendered MatrixStudio component.
 */
export function MatrixStudio({ initialMatrix }: MatrixStudioProps) {
  const router = useRouter();
  const { submitMatrix } = useMatrixSubmit();

  const [matrix, setMatrix] = useState<ThesisMatrix>({
    subjectProblem: initialMatrix?.subjectProblem ?? "",
    theoreticalFramework: initialMatrix?.theoreticalFramework ?? "",
    primaryMaterial: initialMatrix?.primaryMaterial ?? "",
    methodology: initialMatrix?.methodology ?? "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFieldChange = useCallback(
    (field: keyof ThesisMatrix, value: string) => {
      setMatrix((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleConfirmAndProceed = useCallback(async () => {
    if (isSubmitting) return;

    if (!matrix.subjectProblem.trim() || !matrix.methodology.trim()) {
      toast.error(
        "Lütfen en azından Araştırma Problemi ve Metodoloji kadranlarını doldurun.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitMatrix(matrix);
      if (!result.success && result.error) {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, matrix, submitMatrix]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <AIBanner
        icon={CheckCircle2}
        title="Tez Matrisiniz Akademik Hassasiyetle Yapılandırıldı"
        description="Tez öneriniz, taranan literatür kanıtları ve odak tercihleriniz harmanlanarak aşağıdaki 4 temel kadran oluşturuldu. Kadranları inceleyebilir, gerekirse düzenleyebilir ve onaylayarak Konumlandırma adımına geçebilirsiniz."
      />

      <div className="grid grid-cols-1 gap-4">
        {/* 01. Problem */}
        <Card className="p-5 sm:p-6 space-y-3 rounded-md border border-border bg-card">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center size-5 rounded bg-primary/10 text-primary font-mono text-xs font-semibold">
              01
            </span>
            <Target className="size-4 text-muted-foreground shrink-0" />
            <Label
              htmlFor="subjectProblem"
              className="text-sm font-semibold text-foreground"
            >
              Araştırma Problemi, Aktörler ve Odak
            </Label>
          </div>
          <Textarea
            id="subjectProblem"
            value={matrix.subjectProblem}
            onChange={(e) =>
              handleFieldChange("subjectProblem", e.target.value)
            }
            rows={5}
            placeholder="Araştırmanın çözmeyi hedeflediği temel kuramsal veya pratik mesele..."
            className="textarea-academic border-border focus-visible:ring-primary/20 text-sm leading-relaxed"
          />
        </Card>

        {/* 02. Theoretical Framework */}
        <Card className="p-5 sm:p-6 space-y-3 rounded-md border border-border bg-card">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center size-5 rounded bg-primary/10 text-primary font-mono text-xs font-semibold">
              02
            </span>
            <Compass className="size-4 text-muted-foreground shrink-0" />
            <Label
              htmlFor="theoreticalFramework"
              className="text-sm font-semibold text-foreground"
            >
              Teorik ve Kavramsal Çerçeve
            </Label>
          </div>
          <Textarea
            id="theoreticalFramework"
            value={matrix.theoreticalFramework}
            onChange={(e) =>
              handleFieldChange("theoreticalFramework", e.target.value)
            }
            rows={5}
            placeholder="Çalışmanın yaslandığı kavramsal paradigma, temel teoriler ve anahtar kavramlar..."
            className="textarea-academic border-border focus-visible:ring-primary/20 text-sm leading-relaxed"
          />
        </Card>

        {/* 03. Primary Material */}
        <Card className="p-5 sm:p-6 space-y-3 rounded-md border border-border bg-card">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center size-5 rounded bg-primary/10 text-primary font-mono text-xs font-semibold">
              03
            </span>
            <Database className="size-4 text-muted-foreground shrink-0" />
            <Label
              htmlFor="primaryMaterial"
              className="text-sm font-semibold text-foreground"
            >
              Veri Kaynağı / Birincil Malzeme
            </Label>
          </div>
          <Textarea
            id="primaryMaterial"
            value={matrix.primaryMaterial ?? ""}
            onChange={(e) =>
              handleFieldChange("primaryMaterial", e.target.value)
            }
            rows={4}
            placeholder="İncelenecek arşiv belgeleri, saha görüşmeleri, anket verileri veya metin külliyatı..."
            className="textarea-academic border-border focus-visible:ring-primary/20 text-sm leading-relaxed"
          />
        </Card>

        {/* 04. Methodology */}
        <Card className="p-5 sm:p-6 space-y-3 rounded-md border border-border bg-card">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center size-5 rounded bg-primary/10 text-primary font-mono text-xs font-semibold">
              04
            </span>
            <BookOpen className="size-4 text-muted-foreground shrink-0" />
            <Label
              htmlFor="methodology"
              className="text-sm font-semibold text-foreground"
            >
              Metodoloji
            </Label>
          </div>
          <Textarea
            id="methodology"
            value={matrix.methodology}
            onChange={(e) => handleFieldChange("methodology", e.target.value)}
            rows={5}
            placeholder="Verilerin toplanma, analiz edilme ve kuramla buluşturulma yöntemi..."
            className="textarea-academic border-border focus-visible:ring-primary/20 text-sm leading-relaxed"
          />
        </Card>
      </div>

      <div className="flex items-center justify-between pt-4 pb-8">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/onboarding/proposal")}
          disabled={isSubmitting}
        >
          <ArrowLeft className="size-4 mr-2" />
          Öneriye Geri Dön
        </Button>

        <Button
          type="button"
          onClick={handleConfirmAndProceed}
          disabled={isSubmitting}
          size="lg"
          className="cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Konumlandırma Raporu Hazırlanıyor...
            </>
          ) : (
            <>
              Onayla ve Konumlandırma Adımına Geç
              <ArrowRight className="size-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
