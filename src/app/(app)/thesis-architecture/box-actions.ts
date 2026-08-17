"use server";

import { db } from "@/core/db";
import { boxes } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Updates a topic box (title, description, concepts, semanticQuery) post-onboarding.
 */
export async function updateBoxAction(data: {
  id: number;
  title?: string;
  description?: string;
  concepts?: string[];
  semanticQuery?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const targetBox = await db.query.boxes.findFirst({
      where: eq(boxes.id, data.id),
      with: { matrix: true },
    });

    if (!targetBox || targetBox.matrix.userId !== session.userId) {
      return {
        success: false,
        error: "Kutu bulunamadı veya erişim yetkiniz yok.",
      };
    }

    const updateData: Partial<typeof boxes.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof data.title === "string" && data.title.trim() !== "")
      updateData.title = data.title.trim();
    if (typeof data.description === "string")
      updateData.description = data.description.trim() || null;
    if (Array.isArray(data.concepts))
      updateData.concepts = data.concepts.map((c) => c.trim()).filter(Boolean);
    if (typeof data.semanticQuery === "string")
      updateData.semanticQuery = data.semanticQuery.trim() || null;

    if (
      !updateData.title &&
      !updateData.description &&
      !updateData.concepts &&
      updateData.semanticQuery === undefined
    ) {
      return { success: false, error: "Güncellenecek alan bulunamadı." };
    }

    await db.update(boxes).set(updateData).where(eq(boxes.id, data.id));

    revalidatePath("/thesis-architecture");
    revalidatePath("/thesis-architecture/boxes");
    return { success: true };
  } catch (err) {
    console.error("updateBoxAction error:", err);
    return { success: false, error: "Kutu güncellenirken bir hata oluştu." };
  }
}

/**
 * Creates a new sub-topic box under an existing root parent box.
 */
export async function createSubBoxAction(data: {
  parentId: number;
  title: string;
  description?: string;
  concepts?: string[];
  semanticQuery?: string;
}): Promise<{ success: boolean; boxId?: number; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const parentBox = await db.query.boxes.findFirst({
      where: eq(boxes.id, data.parentId),
      with: { matrix: true },
    });

    if (!parentBox || parentBox.matrix.userId !== session.userId) {
      return {
        success: false,
        error: "Ana araştırma ekseni bulunamadı veya yetkiniz yok.",
      };
    }

    const trimmedTitle = data.title.trim();
    if (!trimmedTitle) {
      return { success: false, error: "Alt konu başlığı boş olamaz." };
    }

    const sanitizedConcepts = Array.isArray(data.concepts)
      ? data.concepts.map((c) => c.trim()).filter(Boolean)
      : [];

    const [newBox] = await db
      .insert(boxes)
      .values({
        matrixId: parentBox.matrixId,
        parentId: parentBox.id,
        boxType: parentBox.boxType,
        title: trimmedTitle,
        description: data.description?.trim() || null,
        concepts: sanitizedConcepts,
        semanticQuery: data.semanticQuery?.trim() || null,
      })
      .returning({ id: boxes.id });

    revalidatePath("/thesis-architecture");
    revalidatePath("/thesis-architecture/boxes");
    return { success: true, boxId: newBox.id };
  } catch (err) {
    console.error("createSubBoxAction error:", err);
    return {
      success: false,
      error: "Yeni alt konu eklenirken bir hata oluştu.",
    };
  }
}

/**
 * Deletes a sub-topic box after confirming ownership.
 */
export async function deleteSubBoxAction(
  boxId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const targetBox = await db.query.boxes.findFirst({
      where: eq(boxes.id, boxId),
      with: { matrix: true },
    });

    if (!targetBox || targetBox.matrix.userId !== session.userId) {
      return {
        success: false,
        error: "Kutu bulunamadı veya silme yetkiniz yok.",
      };
    }

    if (targetBox.parentId === null) {
      return {
        success: false,
        error: "Ana araştırma ekseni sütunları doğrudan silinemez.",
      };
    }

    await db.delete(boxes).where(eq(boxes.id, boxId));

    revalidatePath("/thesis-architecture");
    revalidatePath("/thesis-architecture/boxes");
    return { success: true };
  } catch (err) {
    console.error("deleteSubBoxAction error:", err);
    return { success: false, error: "Kutu silinirken bir hata oluştu." };
  }
}
