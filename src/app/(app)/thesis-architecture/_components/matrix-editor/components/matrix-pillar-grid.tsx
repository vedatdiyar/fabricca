"use client";

import { MATRIX_CARDS } from "../constants/matrix-cards";
import type { MatrixKey } from "../constants/matrix-cards";
import type { MatrixValues } from "../hooks/use-matrix-values";
import { MatrixPillarCard } from "./matrix-pillar-card";

interface MatrixPillarGridProps {
  values: MatrixValues;
  onEdit: (key: MatrixKey) => void;
}

/**
 * Grid container that lays out the four main matrix pillar cards.
 *
 * @param root0 - Component props.
 * @param root0.values - The current matrix pillar values.
 * @param root0.onEdit - Opens the edit modal for a given pillar key.
 */
export function MatrixPillarGrid({ values, onEdit }: MatrixPillarGridProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {MATRIX_CARDS.map((card) => (
        <MatrixPillarCard
          key={card.key}
          card={card}
          value={values[card.key] ?? ""}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
