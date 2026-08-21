"use server";

import { db } from "@/core/db";
import { matrices, outlines } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
    new Logger(createFlowId()).error("createOutlineSectionAction error:", {
      service: "thesis-architecture",
      error: err,
    });
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
  academicField?: string | null;
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
    if (typeof data.academicField === "string" || data.academicField === null)
      updateData.academicField = data.academicField;

    await db.update(outlines).set(updateData).where(eq(outlines.id, data.id));

    revalidatePath("/thesis-architecture");
    return { success: true };
  } catch (err) {
    new Logger(createFlowId()).error("updateOutlineSectionAction error:", {
      service: "thesis-architecture",
      error: err,
    });
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
    new Logger(createFlowId()).error("deleteOutlineSectionAction error:", {
      service: "thesis-architecture",
      error: err,
    });
    return { success: false, error: "Bölüm silinirken bir hata oluştu." };
  }
}
