import { db } from "@/core/db";
import { matrices, type Matrix } from "@/core/db/schema";
import { eq } from "drizzle-orm";
import type { MutationToolHandler, MutationToolResult } from "./mutation-types";
import { runMatrixRealignmentCascade } from "../_services/realignment/matrix-realignment-orchestrator";

/**
 * Captures the current thesis matrix fields for the undo preview.
 *
 * @param _args - Mutation arguments (unused for the matrix).
 * @param userId - Authenticated user ID.
 * @returns The existing matrix field values, or undefined.
 */
async function getMatrixPreviousState(
  _args: Record<string, unknown>,
  userId: number,
): Promise<Record<string, unknown> | undefined> {
  const matrix = await db.query.matrices.findFirst({
    where: eq(matrices.userId, userId),
  });
  if (!matrix) return undefined;
  return {
    subjectProblem: matrix.subjectProblem ?? "",
    theoreticalFramework: matrix.theoreticalFramework ?? "",
    primaryMaterial: matrix.primaryMaterial ?? "",
    methodology: matrix.methodology ?? "",
  };
}

/**
 * Updates one or more thesis matrix fields and triggers the Cascading Realignment Pipeline.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The update result with the captured previous state and cascade details.
 */
async function executeMatrixUpdate(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const userMatrix = await db.query.matrices.findFirst({
    where: eq(matrices.userId, userId),
  });
  if (!userMatrix) {
    return { success: false, error: "Tez matrisi bulunamadı." };
  }

  const previousState: Record<string, unknown> = {
    subjectProblem: userMatrix.subjectProblem,
    theoreticalFramework: userMatrix.theoreticalFramework,
    primaryMaterial: userMatrix.primaryMaterial,
    methodology: userMatrix.methodology,
  };

  const updateData: Partial<Matrix> = {};
  const changedFields: string[] = [];

  if (typeof args.subjectProblem === "string") {
    updateData.subjectProblem = args.subjectProblem;
    changedFields.push(`Konu/Problem: "${args.subjectProblem}"`);
  }
  if (typeof args.theoreticalFramework === "string") {
    updateData.theoreticalFramework = args.theoreticalFramework;
    changedFields.push(`Kuramsal Çerçeve: "${args.theoreticalFramework}"`);
  }
  if (typeof args.primaryMaterial === "string") {
    updateData.primaryMaterial = args.primaryMaterial;
    changedFields.push(`Birincil Materyal: "${args.primaryMaterial}"`);
  }
  if (typeof args.methodology === "string") {
    updateData.methodology = args.methodology;
    changedFields.push(`Yöntem/Metodoloji: "${args.methodology}"`);
  }

  await db
    .update(matrices)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(matrices.id, userMatrix.id));

  // Run the Cascading Realignment & Literature Pipeline
  const cascadeRes = await runMatrixRealignmentCascade(
    userId,
    changedFields.join("; "),
  );

  const finalMessage = cascadeRes.success
    ? `Tez matrisi güncellendi. Kademeli etki analizi tamamlandı: ${cascadeRes.createdBoxes.length} yeni araştırma kutusu, ${cascadeRes.addedSources.length} yeni kaynak ve ${cascadeRes.createdTasks.length} çalışma görevi oluşturuldu.`
    : "Tez matrisi başarıyla güncellendi.";

  return {
    success: true,
    message: finalMessage,
    data: {
      matrixId: userMatrix.id,
      cascade: cascadeRes,
    },
    previousState,
  };
}

/** Mutation handlers for the thesis matrix tool. */
export const matrixMutations: Record<string, MutationToolHandler> = {
  updateThesisMatrix: {
    execute: executeMatrixUpdate,
    getPreviousState: getMatrixPreviousState,
  },
};
