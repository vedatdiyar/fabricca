import { db } from "@/db";
import { matrices, outlines, outlineAnnotations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { MutationToolHandler, MutationToolResult } from "./mutation-types";

/**
 * Creates a new outline section under the user's thesis matrix.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The creation result.
 */
async function executeCreateOutlineSection(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const userMatrix = await db.query.matrices.findFirst({
    where: eq(matrices.userId, userId),
  });
  if (!userMatrix) {
    return { success: false, error: "Tez matrisi bulunamadı." };
  }
  const title = args.title as string;
  const description = (args.description as string | undefined) ?? null;
  const parentId = (args.parentId as number | undefined) ?? null;

  const existingOutlines = await db.query.outlines.findMany({
    where: eq(outlines.matrixId, userMatrix.id),
  });
  const nextSortOrder =
    existingOutlines.length > 0
      ? Math.max(...existingOutlines.map((o) => o.sortOrder)) + 1
      : 1;

  const [newSection] = await db
    .insert(outlines)
    .values({
      matrixId: userMatrix.id,
      parentId,
      title,
      description,
      sortOrder: nextSortOrder,
    })
    .returning();

  return {
    success: true,
    message: `"${title}" bölümü bölüm planınıza eklendi.`,
    data: newSection,
  };
}

/**
 * Updates the title and/or description of an outline section.
 *
 * @param args - The proposed mutation arguments.
 * @returns The update result with the captured previous state.
 */
async function executeUpdateOutlineSection(
  args: Record<string, unknown>,
): Promise<MutationToolResult> {
  const outlineId = args.outlineId as number;
  const existingOutline = await db.query.outlines.findFirst({
    where: eq(outlines.id, outlineId),
  });
  if (!existingOutline) {
    return { success: false, error: "Bölüm bulunamadı." };
  }

  const previousState: Record<string, unknown> = {
    title: existingOutline.title,
    description: existingOutline.description,
  };

  const updateData: Partial<typeof outlines.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (typeof args.title === "string") updateData.title = args.title;
  if (typeof args.description === "string")
    updateData.description = args.description;

  await db.update(outlines).set(updateData).where(eq(outlines.id, outlineId));

  return {
    success: true,
    message: "Bölüm detayları güncellendi.",
    previousState,
  };
}

/**
 * Pins a citation annotation to an outline section.
 *
 * @param args - The proposed mutation arguments.
 * @returns The pin result.
 */
async function executePinAnnotationToOutline(
  args: Record<string, unknown>,
): Promise<MutationToolResult> {
  const outlineId = args.outlineId as number;
  const annotationId = args.annotationId as number;

  const existing = await db.query.outlineAnnotations.findFirst({
    where: and(
      eq(outlineAnnotations.outlineId, outlineId),
      eq(outlineAnnotations.annotationId, annotationId),
    ),
  });

  if (existing) {
    return {
      success: true,
      message: "Alıntı fişi zaten bu bölüme iğnelenmiş.",
    };
  }

  await db.insert(outlineAnnotations).values({
    outlineId,
    annotationId,
  });

  return {
    success: true,
    message: "Alıntı fişi bölüme iğnelendi.",
  };
}

/** Mutation handlers for the outline tools. */
export const outlineMutations: Record<string, MutationToolHandler> = {
  createOutlineSection: {
    execute: executeCreateOutlineSection,
    getPreviousState: async () => undefined,
  },
  updateOutlineSection: {
    execute: executeUpdateOutlineSection,
    getPreviousState: async () => undefined,
  },
  pinAnnotationToOutline: {
    execute: executePinAnnotationToOutline,
    getPreviousState: async () => undefined,
  },
};
