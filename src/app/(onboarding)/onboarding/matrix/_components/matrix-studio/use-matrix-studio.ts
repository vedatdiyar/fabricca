"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { ThesisMatrix } from "@/lib/types";
import { useMatrixSubmit } from "@/app/(onboarding)/onboarding/_hooks/use-matrix-submit";

interface UseMatrixStudioOptions {
  initialMatrix?: {
    id?: number;
    subjectProblem?: string;
    theoreticalFramework?: string;
    primaryMaterial?: string | null;
    methodology?: string;
  } | null;
}

/**
 * Encapsulates matrix editing, draft and submission state for MatrixStudio.
 *
 * @param options - Initial matrix data.
 * @returns Matrix studio state and handlers.
 */
export function useMatrixStudio({ initialMatrix }: UseMatrixStudioOptions) {
  const { submitMatrix } = useMatrixSubmit();

  const [matrix, setMatrix] = useState<ThesisMatrix>({
    subjectProblem: initialMatrix?.subjectProblem ?? "",
    theoreticalFramework: initialMatrix?.theoreticalFramework ?? "",
    primaryMaterial: initialMatrix?.primaryMaterial ?? "",
    methodology: initialMatrix?.methodology ?? "",
  });

  const [editingCards, setEditingCards] = useState<
    Record<keyof ThesisMatrix, boolean>
  >({
    subjectProblem: false,
    theoreticalFramework: false,
    primaryMaterial: false,
    methodology: false,
  });

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
      setEditingCards({
        subjectProblem: false,
        theoreticalFramework: false,
        primaryMaterial: false,
        methodology: false,
      });
    } else {
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

  return {
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
  };
}
