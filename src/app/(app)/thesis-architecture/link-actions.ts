"use server";

import { db } from "@/core/db";
import { outlineAnnotations, outlineSources } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Links a Citation Card (annotation) to an Outline section.
 */
export async function linkAnnotationToOutlineAction(
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
    console.error("linkAnnotationToOutlineAction error:", err);
    return {
      success: false,
      error: "Alıntı fişi bölüme bağlanırken bir hata oluştu.",
    };
  }
}

/**
 * Unlinks a Citation Card (annotation) from an Outline section.
 */
export async function unlinkAnnotationFromOutlineAction(
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
    console.error("unlinkAnnotationFromOutlineAction error:", err);
    return { success: false, error: "Fiş bağı kaldırılırken bir hata oluştu." };
  }
}

/**
 * Links an academic Source to an Outline section.
 */
export async function linkSourceToOutlineAction(
  outlineId: number,
  sourceId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    const existing = await db.query.outlineSources.findFirst({
      where: and(
        eq(outlineSources.outlineId, outlineId),
        eq(outlineSources.sourceId, sourceId),
      ),
    });

    if (existing) return { success: true };

    await db.insert(outlineSources).values({
      outlineId,
      sourceId,
    });

    revalidatePath("/thesis-architecture");
    revalidatePath("/library");
    return { success: true };
  } catch (err) {
    console.error("linkSourceToOutlineAction error:", err);
    return {
      success: false,
      error: "Kaynak bölüme bağlanırken bir hata oluştu.",
    };
  }
}

/**
 * Unlinks an academic Source from an Outline section.
 */
export async function unlinkSourceFromOutlineAction(
  outlineId: number,
  sourceId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum bulunamadı." };

    await db
      .delete(outlineSources)
      .where(
        and(
          eq(outlineSources.outlineId, outlineId),
          eq(outlineSources.sourceId, sourceId),
        ),
      );

    revalidatePath("/thesis-architecture");
    revalidatePath("/library");
    return { success: true };
  } catch (err) {
    console.error("unlinkSourceFromOutlineAction error:", err);
    return {
      success: false,
      error: "Kaynak bağı kaldırılırken bir hata oluştu.",
    };
  }
}
