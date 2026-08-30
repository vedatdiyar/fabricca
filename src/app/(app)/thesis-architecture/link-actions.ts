"use server";

import { db } from "@/core/db";
import { outlineAnnotations, outlineSources } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { handleActionError } from "@/lib/errors/handle-error";
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
    return handleActionError(err);
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
    return handleActionError(err);
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
    return handleActionError(err);
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
    return handleActionError(err);
  }
}
