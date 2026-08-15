"use client";

import { useMemo } from "react";
import { MATRIX_CARDS } from "../constants/matrix-cards";
import type { MatrixKey } from "../constants/matrix-cards";
import { countWords } from "../utils/text-metrics";
import type { MatrixValues } from "./use-matrix-values";

export interface MatrixStats {
  counts: Record<MatrixKey, number>;
  filledCount: number;
  totalWords: number;
  isFullyCompleted: boolean;
}

/**
 * Reactively derives word counts, filled pillar count and completion status
 * from the current matrix values.
 *
 * @param values - The current matrix pillar values.
 * @returns The derived word/column statistics.
 */
export function useMatrixStats(values: MatrixValues): MatrixStats {
  return useMemo(() => {
    const counts: Record<MatrixKey, number> = {
      subjectProblem: countWords(values.subjectProblem),
      theoreticalFramework: countWords(values.theoreticalFramework),
      primaryMaterial: countWords(values.primaryMaterial),
      methodology: countWords(values.methodology),
    };

    const filledCount = MATRIX_CARDS.filter(
      (c) => values[c.key]?.trim().length > 0,
    ).length;

    const totalWords = Object.values(counts).reduce((a, b) => a + b, 0);

    return {
      counts,
      filledCount,
      totalWords,
      isFullyCompleted: filledCount === MATRIX_CARDS.length,
    };
  }, [values]);
}
