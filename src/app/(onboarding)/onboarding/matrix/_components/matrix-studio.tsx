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
  Pencil,
  Check,
  X,
  Eye,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

interface QuadrantConfig {
  key: keyof ThesisMatrix;
  number: string;
  icon: typeof Target;
  title: string;
  placeholder: string;
  rows: number;
  required?: boolean;
}

const QUADRANTS: QuadrantConfig[] = [
  {
    key: "subjectProblem",
    number: "01",
    icon: Target,
    title: "Araştırma Problemi, Aktörler ve Odak",
    placeholder:
      "Araştırmanın çözmeyi hedeflediği temel kuramsal veya pratik mesele, çalışmanın odaklandığı aktörler ve problem sahası...",
    rows: 5,
    required: true,
  },
  {
    key: "theoreticalFramework",
    number: "02",
    icon: Compass,
    title: "Teorik ve Kavramsal Çerçeve",
    placeholder:
      "Çalışmanın yaslandığı kavramsal paradigma, temel teoriler ve anahtar kavramlar...",
    rows: 5,
  },
  {
    key: "primaryMaterial",
    number: "03",
    icon: Database,
    title: "Veri Kaynağı / Birincil Malzeme",
    placeholder:
      "İncelenecek arşiv belgeleri, saha görüşmeleri, anket verileri veya metin külliyatı...",
    rows: 4,
  },
  {
    key: "methodology",
    number: "04",
    icon: BookOpen,
    title: "Metodoloji ve Araştırma Yöntemi",
    placeholder:
      "Verilerin toplanma, analiz edilme ve kuramla buluşturulma yöntemi...",
    rows: 5,
    required: true,
  },
];

/**
 * Onboarding Step 2: 4-Quadrant Academic Thesis Matrix review, editing, and confirmation studio.
 * Supports elegant preview mode by default with per-card inline editing triggered via edit icons.
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

  // Track editing state per quadrant
  const [editingCards, setEditingCards] = useState<
    Record<keyof ThesisMatrix, boolean>
  >({
    subjectProblem: false,
    theoreticalFramework: false,
    primaryMaterial: false,
    methodology: false,
  });

  // Draft values during active edit
  const [drafts, setDrafts] = useState<ThesisMatrix>({
    subjectProblem: initialMatrix?.subjectProblem ?? "",
    theoreticalFramework: initialMatrix?.theoreticalFramework ?? "",
    primaryMaterial: initialMatrix?.primaryMaterial ?? "",
    methodology: initialMatrix?.methodology ?? "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAnyEditing = Object.values(editingCards).some(Boolean);

  const handleStartEdit = useCallback(
    (field: keyof ThesisMatrix) => {
      setDrafts((prev) => ({ ...prev, [field]: matrix[field] }));
      setEditingCards((prev) => ({ ...prev, [field]: true }));
    },
    [matrix],
  );

  const handleCancelEdit = useCallback(
    (field: keyof ThesisMatrix) => {
      setDrafts((prev) => ({ ...prev, [field]: matrix[field] }));
      setEditingCards((prev) => ({ ...prev, [field]: false }));
    },
    [matrix],
  );

  const handleSaveEdit = useCallback(
    (field: keyof ThesisMatrix) => {
      setMatrix((prev) => ({ ...prev, [field]: drafts[field] }));
      setEditingCards((prev) => ({ ...prev, [field]: false }));
      toast.success("Kadran içeriği güncellendi.");
    },
    [drafts],
  );

  const handleDraftChange = useCallback(
    (field: keyof ThesisMatrix, value: string) => {
      setDrafts((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleToggleAllEdit = useCallback(() => {
    if (isAnyEditing) {
      // Revert/save all
      setEditingCards({
        subjectProblem: false,
        theoreticalFramework: false,
        primaryMaterial: false,
        methodology: false,
      });
    } else {
      // Start editing all
      setDrafts(matrix);
      setEditingCards({
        subjectProblem: true,
        theoreticalFramework: true,
        primaryMaterial: true,
        methodology: true,
      });
    }
  }, [isAnyEditing, matrix]);

  const handleConfirmAndProceed = useCallback(async () => {
    if (isSubmitting) return;

    // Automatically sync any open drafts before validation and submission
    const finalMatrix: ThesisMatrix = {
      subjectProblem: editingCards.subjectProblem
        ? drafts.subjectProblem
        : matrix.subjectProblem,
      theoreticalFramework: editingCards.theoreticalFramework
        ? drafts.theoreticalFramework
        : matrix.theoreticalFramework,
      primaryMaterial: editingCards.primaryMaterial
        ? drafts.primaryMaterial
        : matrix.primaryMaterial,
      methodology: editingCards.methodology
        ? drafts.methodology
        : matrix.methodology,
    };

    if (!finalMatrix.subjectProblem.trim() || !finalMatrix.methodology.trim()) {
      toast.error(
        "Lütfen en azından Araştırma Problemi ve Metodoloji kadranlarını doldurun.",
      );
      return;
    }

    setMatrix(finalMatrix);
    setEditingCards({
      subjectProblem: false,
      theoreticalFramework: false,
      primaryMaterial: false,
      methodology: false,
    });

    setIsSubmitting(true);

    try {
      const result = await submitMatrix(finalMatrix);
      if (!result.success && result.error) {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, editingCards, drafts, matrix, submitMatrix]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <AIBanner
        icon={CheckCircle2}
        title="Tez Matrisiniz Akademik Hassasiyetle Yapılandırıldı"
        description="Tez öneriniz, taranan literatür kanıtları ve odak tercihleriniz harmanlanarak aşağıdaki 4 temel kadran oluşturuldu. Kadranları önizleyebilir, düzenleme ikonuna tıklayarak geliştirebilir ve onaylayarak Konumlandırma adımına geçebilirsiniz."
      />

      <div className="flex items-center justify-between px-1">
        <div className="text-xs text-muted-foreground font-medium">
          {isAnyEditing ? (
            <span className="text-primary flex items-center gap-1.5">
              <Pencil className="size-3.5" />
              Kadranlar düzenleme modunda
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Eye className="size-3.5 text-muted-foreground" />
              Önizleme modu (Düzenlemek istediğiniz kutudaki kaleme tıklayın)
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleToggleAllEdit}
          className="h-7 text-xs px-2.5 rounded-md gap-1.5 text-muted-foreground hover:text-foreground"
        >
          {isAnyEditing ? (
            <>
              <Eye className="size-3.5 text-muted-foreground" />
              <span>Önizlemeye Dön</span>
            </>
          ) : (
            <>
              <Edit3 className="size-3.5 text-primary" />
              <span>Tümünü Düzenle</span>
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {QUADRANTS.map((quadrant) => {
          const isEditing = editingCards[quadrant.key];
          const content = matrix[quadrant.key] || "";
          const draftContent = drafts[quadrant.key] || "";
          const Icon = quadrant.icon;

          return (
            <Card
              key={quadrant.key}
              className={`p-5 sm:p-6 space-y-3.5 rounded-md border bg-card transition-all ${
                isEditing
                  ? "border-primary/40 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30"
              }`}
            >
              {/* Header with index, semantic icon, title and edit/action controls */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex items-center justify-center size-6 rounded bg-primary/10 text-primary font-mono text-xs font-semibold shrink-0">
                    {quadrant.number}
                  </span>
                  <Icon className="size-4 text-primary shrink-0" />
                  <h3 className="font-serif text-sm font-semibold tracking-tight text-foreground truncate">
                    {quadrant.title}
                  </h3>
                  {quadrant.required && (
                    <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">
                      Zorunlu
                    </span>
                  )}
                </div>

                {/* Edit & Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isEditing ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelEdit(quadrant.key)}
                        className="h-7 text-xs px-2.5 rounded-md text-muted-foreground hover:text-foreground gap-1"
                      >
                        <X className="size-3.5" />
                        <span>İptal</span>
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSaveEdit(quadrant.key)}
                        className="h-7 text-xs px-2.5 rounded-md font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 gap-1"
                      >
                        <Check className="size-3.5" />
                        <span>Kaydet</span>
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(quadrant.key)}
                      className="h-7 text-xs px-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary gap-1.5 transition-colors"
                      title={`${quadrant.title} alanını düzenle`}
                    >
                      <Pencil className="size-3.5 text-primary" />
                      <span>Düzenle</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Body: Preview or Textarea Edit */}
              {isEditing ? (
                <div className="space-y-2 pt-1">
                  <Textarea
                    id={quadrant.key}
                    value={draftContent}
                    onChange={(e) =>
                      handleDraftChange(quadrant.key, e.target.value)
                    }
                    rows={quadrant.rows}
                    placeholder={quadrant.placeholder}
                    className="textarea-academic border-border focus-visible:ring-primary/20 text-sm leading-relaxed"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    {quadrant.placeholder}
                  </p>
                </div>
              ) : (
                <div
                  onClick={() => handleStartEdit(quadrant.key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleStartEdit(quadrant.key);
                    }
                  }}
                  className={`p-4 rounded-md text-sm leading-relaxed text-foreground whitespace-pre-wrap transition-colors cursor-pointer border ${
                    content.trim().length > 0
                      ? "bg-secondary/30 border-border/40 hover:border-primary/30 hover:bg-secondary/50 font-normal"
                      : "bg-muted/20 border-dashed border-border/60 hover:border-primary/40 text-xs italic text-muted-foreground flex items-center gap-2"
                  }`}
                  title="Düzenlemek için tıklayın"
                >
                  {content.trim().length > 0 ? (
                    content
                  ) : (
                    <>
                      <Pencil className="size-3.5 text-muted-foreground shrink-0" />
                      <span>
                        Henüz içerik girilmedi. Düzenlemek için tıklayın.
                      </span>
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
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
