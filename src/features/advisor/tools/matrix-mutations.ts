import { db } from "@/db";
import { matrices, type Matrix } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { MutationToolHandler, MutationToolResult } from "./mutation-types";

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
 * Updates one or more thesis matrix fields.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The update result with the captured previous state.
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
  if (typeof args.subjectProblem === "string")
    updateData.subjectProblem = args.subjectProblem;
  if (typeof args.theoreticalFramework === "string")
    updateData.theoreticalFramework = args.theoreticalFramework;
  if (typeof args.primaryMaterial === "string")
    updateData.primaryMaterial = args.primaryMaterial;
  if (typeof args.methodology === "string")
    updateData.methodology = args.methodology;

  await db
    .update(matrices)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(matrices.id, userMatrix.id));

  return {
    success: true,
    message: "Tez matrisi başarıyla güncellendi.",
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
