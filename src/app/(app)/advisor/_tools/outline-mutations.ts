import { db } from "@/core/db";
import {
  matrices,
  outlines,
  outlineAnnotations,
  outlineSources,
} from "@/core/db/schema";
import { eq, and } from "drizzle-orm";
import type { MutationToolHandler, MutationToolResult } from "./mutation-types";
import { toNumericId } from "./mutation-types";

/**
 * Verifies that an outline belongs to the authenticated user's matrix.
 *
 * @param outlineId - The outline ID to check.
 * @param userId - Authenticated user ID.
 * @returns True when the outline's matrix belongs to the user.
 */
async function isOutlineOwnedByUser(
  outlineId: number,
  userId: number,
): Promise<boolean> {
  const outline = await db.query.outlines.findFirst({
    where: eq(outlines.id, outlineId),
  });
  if (!outline) return false;
  const matrix = await db.query.matrices.findFirst({
    where: eq(matrices.id, outline.matrixId),
  });
  return matrix?.userId === userId;
}

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
 * @param userId - Authenticated user ID.
 * @returns The update result with the captured previous state.
 */
async function executeUpdateOutlineSection(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const outlineId = toNumericId(args.outlineId);
  if (!outlineId) return { success: false, error: "Bölüm bulunamadı." };
  const existingOutline = await db.query.outlines.findFirst({
    where: eq(outlines.id, outlineId),
  });
  if (!existingOutline) {
    return { success: false, error: "Bölüm bulunamadı." };
  }
  if (!(await isOutlineOwnedByUser(outlineId, userId))) {
    return { success: false, error: "Bu bölümü güncelleme yetkiniz yok." };
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
 * @param userId - Authenticated user ID.
 * @returns The pin result.
 */
async function executePinAnnotationToOutline(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const outlineId = toNumericId(args.outlineId);
  const annotationId = toNumericId(args.annotationId);
  if (!outlineId || !annotationId) {
    return { success: false, error: "Geçersiz bölüm veya alıntı kimliği." };
  }
  if (!(await isOutlineOwnedByUser(outlineId, userId))) {
    return { success: false, error: "Bu bölüme iğneleme yetkiniz yok." };
  }

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

/**
 * Removes a citation annotation from an outline section.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The unpin result.
 */
async function executeUnpinAnnotationFromOutline(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const outlineId = toNumericId(args.outlineId);
  const annotationId = toNumericId(args.annotationId);
  if (!outlineId || !annotationId) {
    return { success: false, error: "Geçersiz bölüm veya alıntı kimliği." };
  }
  if (!(await isOutlineOwnedByUser(outlineId, userId))) {
    return { success: false, error: "Bu bölümden çıkarma yetkiniz yok." };
  }

  await db
    .delete(outlineAnnotations)
    .where(
      and(
        eq(outlineAnnotations.outlineId, outlineId),
        eq(outlineAnnotations.annotationId, annotationId),
      ),
    );

  return {
    success: true,
    message: "Alıntı fişi bölümden çıkarıldı.",
  };
}

/**
 * Links an academic source to an outline section.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The link result.
 */
async function executeLinkSourceToOutline(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const outlineId = toNumericId(args.outlineId);
  const sourceId = toNumericId(args.sourceId);
  if (!outlineId || !sourceId) {
    return { success: false, error: "Geçersiz bölüm veya kaynak kimliği." };
  }
  if (!(await isOutlineOwnedByUser(outlineId, userId))) {
    return { success: false, error: "Bu bölüme kaynak bağlama yetkiniz yok." };
  }

  const existing = await db.query.outlineSources.findFirst({
    where: and(
      eq(outlineSources.outlineId, outlineId),
      eq(outlineSources.sourceId, sourceId),
    ),
  });

  if (existing) {
    return {
      success: true,
      message: "Kaynak zaten bu bölüme bağlı.",
    };
  }

  await db.insert(outlineSources).values({
    outlineId,
    sourceId,
  });

  return {
    success: true,
    message: "Kaynak bölüme bağlandı.",
  };
}

/**
 * Removes an academic source link from an outline section.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The unlink result.
 */
async function executeUnlinkSourceFromOutline(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const outlineId = toNumericId(args.outlineId);
  const sourceId = toNumericId(args.sourceId);
  if (!outlineId || !sourceId) {
    return { success: false, error: "Geçersiz bölüm veya kaynak kimliği." };
  }
  if (!(await isOutlineOwnedByUser(outlineId, userId))) {
    return {
      success: false,
      error: "Bu bölümden kaynak kaldırma yetkiniz yok.",
    };
  }

  await db
    .delete(outlineSources)
    .where(
      and(
        eq(outlineSources.outlineId, outlineId),
        eq(outlineSources.sourceId, sourceId),
      ),
    );

  return {
    success: true,
    message: "Kaynak bağı bölümden kaldırıldı.",
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
  unpinAnnotationFromOutline: {
    execute: executeUnpinAnnotationFromOutline,
    getPreviousState: async () => undefined,
  },
  linkSourceToOutline: {
    execute: executeLinkSourceToOutline,
    getPreviousState: async () => undefined,
  },
  unlinkSourceFromOutline: {
    execute: executeUnlinkSourceFromOutline,
    getPreviousState: async () => undefined,
  },
};
