"use client";

import { Matrix } from "@/db/schema";
import { MATRIX_CARDS } from "./constants/matrix-cards";
import { useMatrixValues } from "./hooks/use-matrix-values";
import { useMatrixStats } from "./hooks/use-matrix-stats";
import { useMatrixModal } from "./hooks/use-matrix-modal";
import { MatrixMetricsStrip } from "./components/matrix-metrics-strip";
import { MatrixPillarGrid } from "./components/matrix-pillar-grid";
import { EditMatrixColumnModal } from "./components/modals/edit-matrix-column-modal";

interface MatrixEditorViewProps {
  initialMatrix: Matrix;
}

/**
 * Orchestrates the thesis matrix editor: wires the values/stats/modal hooks
 * together and composes the metrics strip, pillar grid and edit modal.
 *
 * @param root0 - Component props.
 * @param root0.initialMatrix - The server-side matrix row to edit.
 */
export function MatrixEditorView({ initialMatrix }: MatrixEditorViewProps) {
  const { values, isSaving, saveValues } = useMatrixValues({ initialMatrix });
  const stats = useMatrixStats(values);
  const modal = useMatrixModal({ values, saveValues });

  const focusCardDef =
    MATRIX_CARDS.find((c) => c.key === modal.focusCardKey) ?? null;

  return (
    <div className="w-full space-y-6">
      {/* Top Overview & Metric Strip */}
      <MatrixMetricsStrip values={values} stats={stats} />

      {/* Main 4-Pillar Grid */}
      <MatrixPillarGrid values={values} onEdit={modal.openModal} />

      {/* Focus & Editing Dialog */}
      <EditMatrixColumnModal
        open={modal.isOpen}
        card={focusCardDef}
        value={modal.focusEditValue}
        isSaving={isSaving}
        onValueChange={modal.setEditValue}
        onClose={modal.closeModal}
        onSave={modal.save}
      />
    </div>
  );
}
