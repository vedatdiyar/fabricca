"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QUADRANTS } from "./quadrant-config";
import { useMatrixStudio } from "./use-matrix-studio";
import { QuadrantCard } from "./quadrant-card";
import { MatrixStudioHeader } from "./matrix-studio-header";

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
  const {
    matrix,
    drafts,
    editingCards,
    isAnyEditing,
    isSubmitting,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleDraftChange,
    handleToggleAllEdit,
    handleConfirmAndProceed,
  } = useMatrixStudio({ initialMatrix });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <MatrixStudioHeader
        isAnyEditing={isAnyEditing}
        onToggleAllEdit={handleToggleAllEdit}
      />

      <div className="grid grid-cols-1 gap-4">
        {QUADRANTS.map((quadrant) => (
          <QuadrantCard
            key={quadrant.key}
            quadrant={quadrant}
            content={matrix[quadrant.key] || ""}
            draftContent={drafts[quadrant.key] || ""}
            isEditing={editingCards[quadrant.key]}
            onStartEdit={() => handleStartEdit(quadrant.key)}
            onCancelEdit={() => handleCancelEdit(quadrant.key)}
            onSaveEdit={() => handleSaveEdit(quadrant.key)}
            onDraftChange={(v) => handleDraftChange(quadrant.key, v)}
          />
        ))}
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
