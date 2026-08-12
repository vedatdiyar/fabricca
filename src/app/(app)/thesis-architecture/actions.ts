"use server";

import { db } from "@/db";
import {
  matrices,
  outlines,
  outlineAnnotations,
  outlineBoxes,
} from "@/db/schema";
import { getSession } from "@/lib/session";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Updates the user's living thesis matrix pillars post-onboarding.
 */
export async function updateMatrixAction(data: {
  subjectProblem?: string;
  theoreticalFramework?: string;
  primaryMaterial?: string;
  methodology?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const userMatrix = await db.query.matrices.findFirst({
      where: eq(matrices.userId, session.userId),
    });

    if (!userMatrix)
      return { success: false, error: "Tez matrisi bulunamadı." };

    const updateData: Partial<typeof matrices.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof data.subjectProblem === "string")
      updateData.subjectProblem = data.subjectProblem;
    if (typeof data.theoreticalFramework === "string")
      updateData.theoreticalFramework = data.theoreticalFramework;
    if (typeof data.primaryMaterial === "string")
      updateData.primaryMaterial = data.primaryMaterial;
    if (typeof data.methodology === "string")
      updateData.methodology = data.methodology;

    await db
      .update(matrices)
      .set(updateData)
      .where(eq(matrices.id, userMatrix.id));

    revalidatePath("/thesis-architecture");
    return { success: true };
  } catch (err) {
    console.error("updateMatrixAction error:", err);
    return { success: false, error: "Matris güncellenirken bir hata oluştu." };
  }
}

/**
 * Creates a new outline chapter or section.
 */
export async function createOutlineSectionAction(data: {
  title: string;
  description?: string;
  parentId?: number | null;
  sortOrder?: number;
  academicField?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const userMatrix = await db.query.matrices.findFirst({
      where: eq(matrices.userId, session.userId),
    });

    if (!userMatrix)
      return { success: false, error: "Tez matrisi bulunamadı." };

    const existingOutlines = await db.query.outlines.findMany({
      where: eq(outlines.matrixId, userMatrix.id),
    });

    const nextSortOrder =
      data.sortOrder ??
      (existingOutlines.length > 0
        ? Math.max(...existingOutlines.map((o) => o.sortOrder)) + 1
        : 1);

    await db.insert(outlines).values({
      matrixId: userMatrix.id,
      parentId: data.parentId ?? null,
      title: data.title,
      description: data.description ?? null,
      sortOrder: nextSortOrder,
      academicField: data.academicField ?? null,
    });

    revalidatePath("/thesis-architecture");
    return { success: true };
  } catch (err) {
    console.error("createOutlineSectionAction error:", err);
    return { success: false, error: "Bölüm eklenirken bir hata oluştu." };
  }
}

/**
 * Updates an existing outline section.
 */
export async function updateOutlineSectionAction(data: {
  id: number;
  title?: string;
  description?: string;
  sortOrder?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const updateData: Partial<typeof outlines.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof data.title === "string") updateData.title = data.title;
    if (typeof data.description === "string")
      updateData.description = data.description;
    if (typeof data.sortOrder === "number")
      updateData.sortOrder = data.sortOrder;

    await db.update(outlines).set(updateData).where(eq(outlines.id, data.id));

    revalidatePath("/thesis-architecture");
    return { success: true };
  } catch (err) {
    console.error("updateOutlineSectionAction error:", err);
    return { success: false, error: "Bölüm güncellenirken bir hata oluştu." };
  }
}

/**
 * Deletes an outline section and its sub-sections.
 */
export async function deleteOutlineSectionAction(
  outlineId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    await db.delete(outlines).where(eq(outlines.id, outlineId));

    revalidatePath("/thesis-architecture");
    return { success: true };
  } catch (err) {
    console.error("deleteOutlineSectionAction error:", err);
    return { success: false, error: "Bölüm silinirken bir hata oluştu." };
  }
}

/**
 * Pins a Citation Card (annotation) to an Outline section.
 */
export async function pinAnnotationAction(
  outlineId: number,
  annotationId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const existing = await db.query.outlineAnnotations.findFirst({
      where: and(
        eq(outlineAnnotations.outlineId, outlineId),
        eq(outlineAnnotations.annotationId, annotationId),
      ),
    });

    if (existing) return { success: true };

    await db.insert(outlineAnnotations).values({
      outlineId,
      annotationId,
    });

    revalidatePath("/thesis-architecture");
    revalidatePath("/citation-cards");
    return { success: true };
  } catch (err) {
    console.error("pinAnnotationAction error:", err);
    return {
      success: false,
      error: "Alıntı fişi bölüme iğnelenirken bir hata oluştu.",
    };
  }
}

/**
 * Unpins a Citation Card (annotation) from an Outline section.
 */
export async function unpinAnnotationAction(
  outlineId: number,
  annotationId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    await db
      .delete(outlineAnnotations)
      .where(
        and(
          eq(outlineAnnotations.outlineId, outlineId),
          eq(outlineAnnotations.annotationId, annotationId),
        ),
      );

    revalidatePath("/thesis-architecture");
    revalidatePath("/citation-cards");
    return { success: true };
  } catch (err) {
    console.error("unpinAnnotationAction error:", err);
    return { success: false, error: "İğne kaldırılırken bir hata oluştu." };
  }
}

/**
 * Links a Topic Box to an Outline section.
 */
export async function linkBoxToOutlineAction(
  outlineId: number,
  boxId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const existing = await db.query.outlineBoxes.findFirst({
      where: and(
        eq(outlineBoxes.outlineId, outlineId),
        eq(outlineBoxes.boxId, boxId),
      ),
    });

    if (existing) return { success: true };

    await db.insert(outlineBoxes).values({
      outlineId,
      boxId,
    });

    revalidatePath("/thesis-architecture");
    return { success: true };
  } catch (err) {
    console.error("linkBoxToOutlineAction error:", err);
    return {
      success: false,
      error: "Kutu bölüme bağlanırken bir hata oluştu.",
    };
  }
}

/**
 * Unlinks a Topic Box from an Outline section.
 */
export async function unlinkBoxFromOutlineAction(
  outlineId: number,
  boxId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    await db
      .delete(outlineBoxes)
      .where(
        and(
          eq(outlineBoxes.outlineId, outlineId),
          eq(outlineBoxes.boxId, boxId),
        ),
      );

    revalidatePath("/thesis-architecture");
    return { success: true };
  } catch (err) {
    console.error("unlinkBoxFromOutlineAction error:", err);
    return {
      success: false,
      error: "Kutu bağı kaldırılırken bir hata oluştu.",
    };
  }
}
