"use server";

import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/core/db";
import { annotations } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { getOwnedSource } from "@/core/services/box/ownership";
import type { NoteType } from "./_lib/types";

/** Note type validation enum matching annotations.noteTypeEnum. */
const noteTypeSchema = z.enum(["DIRECT_QUOTE", "PARAPHRASE", "PERSONAL_NOTE"]);

/** Validation schema for creating a new library note / citation. */
const createResourceNoteSchema = z.object({
  resourceId: z.number().int().positive("Geçerli bir kaynak seçilmelidir."),
  pageNumber: z.string().min(1, "Sayfa numarası gereklidir."),
  noteType: noteTypeSchema,
  content: z.string().trim().min(1, "Lütfen not metnini giriniz."),
  comment: z
    .string()
    .trim()
    .max(4000, "Yorum en fazla 4000 karakter olabilir.")
    .optional(),
});

/**
 * Server Action: Creates a new note / page-numbered citation linked to a library resource.
 *
 * @param input - The note data to create.
 * @param input.resourceId - The ID of the resource the note is linked to.
 * @param input.pageNumber - The page number the note refers to.
 * @param input.noteType - The type of the note.
 * @param input.content - The note text.
 * @param input.comment - Optional personal meta-comment / annotation attached to the note.
 * @returns The created note data on success, or an error message on failure.
 */
export async function createResourceNoteAction(input: {
  resourceId: number;
  pageNumber: string;
  noteType: NoteType;
  content: string;
  comment?: string;
}) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const parsed = createResourceNoteSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        success: false,
        error: issue ? issue.message : "Geçersiz veri.",
      };
    }

    const valid = parsed.data;

    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const owned = await getOwnedSource(valid.resourceId, session.userId);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const comment = valid.comment?.trim() || null;

    const [newNote] = await db
      .insert(annotations)
      .values({
        sourceId: valid.resourceId,
        userId: session.userId,
        pageNumber: valid.pageNumber.trim(),
        noteType: valid.noteType,
        content: valid.content,
        comment,
        sentToCitationCards: true,
      })
      .returning();

    log.info("create_resource_note_success", {
      service: "library",
      data: { noteId: newNote.id, resourceId: valid.resourceId },
    });

    return {
      success: true,
      data: {
        id: newNote.id,
        resourceId: newNote.sourceId,
        pageNumber: newNote.pageNumber,
        noteType: newNote.noteType as NoteType,
        content: newNote.content,
        comment: newNote.comment ?? undefined,
        sentToCitationCards: newNote.sentToCitationCards,
        createdAt: newNote.createdAt.toISOString(),
      },
    };
  } catch (err) {
    log.error("create_resource_note_failed", {
      service: "library",
      error: err,
    });
    return { success: false, error: "Not kaydedilirken bir hata oluştu." };
  }
}

/**
 * Server Action: Deletes a note by ID for the logged in user.
 *
 * @param noteId - The ID of the note to delete.
 * @returns A success flag, or an error message on failure.
 */
export async function deleteResourceNoteAction(noteId: number) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    await db
      .delete(annotations)
      .where(
        and(eq(annotations.id, noteId), eq(annotations.userId, session.userId)),
      );

    log.info("delete_resource_note_success", {
      service: "library",
      data: { noteId },
    });

    return { success: true };
  } catch (err) {
    log.error("delete_resource_note_failed", {
      service: "library",
      error: err,
    });
    return { success: false, error: "Not silinirken bir hata oluştu." };
  }
}
