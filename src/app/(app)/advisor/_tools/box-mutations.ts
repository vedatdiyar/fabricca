import { db } from "@/core/db";
import { boxes, matrices, type Box } from "@/core/db/schema";
import { eq } from "drizzle-orm";
import type { MutationToolHandler, MutationToolResult } from "./mutation-types";
import { toNumericId } from "./mutation-types";

/**
 * Captures the current box fields for the undo preview.
 *
 * @param args - The proposed mutation arguments.
 * @returns The existing box field values, or undefined.
 */
async function getBoxPreviousState(
  args: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  const boxId = toNumericId(args.boxId);
  if (!boxId) return undefined;
  const box = await db.query.boxes.findFirst({
    where: eq(boxes.id, boxId),
  });
  if (!box) return undefined;
  return {
    title: box.title,
    description: box.description ?? "",
    boxType: box.boxType,
  };
}

/**
 * Creates a new box under the user's thesis matrix.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The creation result.
 */
async function executeCreateBox(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const userMatrix = await db.query.matrices.findFirst({
    where: eq(matrices.userId, userId),
  });
  if (!userMatrix) {
    return {
      success: false,
      error: "Önce tez matrisi oluşturulmalıdır.",
    };
  }
  const boxType = args.boxType as Box["boxType"];
  const title = args.title as string;
  const description = (args.description as string | undefined) ?? null;

  const [newBox] = await db
    .insert(boxes)
    .values({
      matrixId: userMatrix.id,
      boxType,
      title,
      description,
    })
    .returning();

  return {
    success: true,
    message: `"${title}" başlıklı yeni kutu oluşturuldu.`,
    data: newBox,
  };
}

/**
 * Updates the title and/or description of an existing box.
 * Verifies ownership via box → matrix → userId chain.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The update result with the captured previous state.
 */
async function executeUpdateBox(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const boxId = toNumericId(args.boxId);
  if (!boxId) return { success: false, error: "Kutu bulunamadı." };

  const existingBox = await db.query.boxes.findFirst({
    where: eq(boxes.id, boxId),
  });
  if (!existingBox) {
    return { success: false, error: "Kutu bulunamadı." };
  }

  // Ownership check: box → matrix → userId
  const ownerMatrix = await db.query.matrices.findFirst({
    where: eq(matrices.id, existingBox.matrixId),
  });
  if (!ownerMatrix || ownerMatrix.userId !== userId) {
    return { success: false, error: "Bu kutuyu güncelleme yetkiniz yok." };
  }

  const previousState: Record<string, unknown> = {
    title: existingBox.title,
    description: existingBox.description,
  };

  const updateData: {
    title?: string;
    description?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (typeof args.title === "string") updateData.title = args.title;
  if (typeof args.description === "string")
    updateData.description = args.description;

  await db.update(boxes).set(updateData).where(eq(boxes.id, boxId));
  return {
    success: true,
    message: "Kutu bilgileri güncellendi.",
    previousState,
  };
}

/**
 * Deletes an existing box.
 * Verifies ownership via box → matrix → userId chain.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The deletion result with the captured previous state.
 */
async function executeDeleteBox(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const boxId = toNumericId(args.boxId);
  if (!boxId) return { success: false, error: "Silinecek kutu bulunamadı." };

  const existingBox = await db.query.boxes.findFirst({
    where: eq(boxes.id, boxId),
  });
  if (!existingBox) {
    return { success: false, error: "Silinecek kutu bulunamadı." };
  }

  // Ownership check: box → matrix → userId
  const ownerMatrix = await db.query.matrices.findFirst({
    where: eq(matrices.id, existingBox.matrixId),
  });
  if (!ownerMatrix || ownerMatrix.userId !== userId) {
    return { success: false, error: "Bu kutuyu silme yetkiniz yok." };
  }

  const previousState: Record<string, unknown> = {
    matrixId: existingBox.matrixId,
    boxType: existingBox.boxType,
    title: existingBox.title,
    description: existingBox.description,
    parentId: existingBox.parentId,
  };

  await db.delete(boxes).where(eq(boxes.id, boxId));
  return { success: true, message: "Kutu silindi.", previousState };
}

/** Mutation handlers for the box tools. */
export const boxMutations: Record<string, MutationToolHandler> = {
  createBox: {
    execute: executeCreateBox,
    getPreviousState: async () => undefined,
  },
  updateBox: {
    execute: executeUpdateBox,
    getPreviousState: getBoxPreviousState,
  },
  deleteBox: {
    execute: executeDeleteBox,
    getPreviousState: getBoxPreviousState,
  },
};
