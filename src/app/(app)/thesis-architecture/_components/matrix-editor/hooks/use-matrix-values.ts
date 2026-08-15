"use client";

import { useState } from "react";
import { Matrix } from "@/db/schema";
import { toast } from "sonner";
import { updateMatrixAction } from "../../../actions";
import type { MatrixKey } from "../constants/matrix-cards";

export type MatrixValues = Record<MatrixKey, string>;

interface UseMatrixValuesOptions {
  initialMatrix: Matrix;
}

interface UseMatrixValuesResult {
  values: MatrixValues;
  isSaving: boolean;
  saveValues: (next: MatrixValues) => Promise<boolean>;
}

/**
 * Owns the editable matrix pillar values and persists changes through the
 * `updateMatrixAction` server action, surfacing success/error toasts.
 *
 * @param root0 - Hook options.
 * @param root0.initialMatrix - The server-side matrix row used as initial state.
 * @returns The matrix values, the in-flight saving flag and the persistence handler.
 */
export function useMatrixValues({
  initialMatrix,
}: UseMatrixValuesOptions): UseMatrixValuesResult {
  const [values, setValues] = useState<MatrixValues>(() => ({
    subjectProblem: initialMatrix.subjectProblem ?? "",
    theoreticalFramework: initialMatrix.theoreticalFramework ?? "",
    primaryMaterial: initialMatrix.primaryMaterial ?? "",
    methodology: initialMatrix.methodology ?? "",
  }));
  const [isSaving, setIsSaving] = useState(false);

  const saveValues = async (next: MatrixValues): Promise<boolean> => {
    setIsSaving(true);
    const res = await updateMatrixAction(next);
    setIsSaving(false);

    if (res.success) {
      setValues(next);
      toast.success("Matris sütunu başarıyla güncellendi.");
      return true;
    }

    toast.error(res.error ?? "Güncellenemedi.");
    return false;
  };

  return { values, isSaving, saveValues };
}
