"use server";

import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import {
  annotations,
  outlineAnnotations,
  outlineSources,
  sources,
  boxes,
  matrices,
} from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";

/**
 * Saves a defense synthesis note as a PERSONAL_NOTE annotation linked to the outline section.
 *
 * @param input - outlineId and noteContent.
 * @returns Success with noteId or an error.
 */
export async function saveDefenseNoteAction(input: {
  outlineId: number;
  noteContent: string;
}): Promise<{ success: boolean; noteId?: number; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const { outlineId, noteContent } = input;
    if (!noteContent || !noteContent.trim()) {
      return { success: false, error: "Not içeriği boş olamaz." };
    }

    const [pinnedSource] = await db
      .select({ sourceId: outlineSources.sourceId })
      .from(outlineSources)
      .where(eq(outlineSources.outlineId, outlineId))
      .limit(1);

    let targetSourceId = pinnedSource?.sourceId;

    if (!targetSourceId) {
      const [anySource] = await db
        .select({ id: sources.id })
        .from(sources)
        .innerJoin(boxes, eq(sources.boxId, boxes.id))
        .innerJoin(matrices, eq(boxes.matrixId, matrices.id))
        .where(eq(matrices.userId, session.userId))
        .limit(1);

      targetSourceId = anySource?.id;
    }

    if (!targetSourceId) {
      return {
        success: false,
        error:
          "Not kaydetmek için kütüphanenizde en az bir kaynak bulunmalıdır.",
      };
    }

    const [insertedAnnotation] = await db
      .insert(annotations)
      .values({
        userId: session.userId,
        sourceId: targetSourceId,
        pageNumber: "Savunma Notu",
        noteType: "PERSONAL_NOTE",
        content: noteContent.trim(),
        comment: "Danışmanın Çalışma Odası Müzakere ve Savunma Sonucu",
        sentToCitationCards: true,
      })
      .returning({ id: annotations.id });

    await db.insert(outlineAnnotations).values({
      outlineId,
      annotationId: insertedAnnotation.id,
    });

    return { success: true, noteId: insertedAnnotation.id };
  } catch (err) {
    new Logger(createFlowId()).error("saveDefenseNoteAction error:", {
      service: "advisor",
      error: err,
    });
    return {
      success: false,
      error: "Savunma notu kaydedilirken bir hata oluştu.",
    };
  }
}
