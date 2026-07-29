"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { libraryResourceNotes } from "@/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import type { NoteType } from "../_types/types";

/**
 * Server Action: Creates a new note / page-numbered citation linked to a library resource.
 *
 * @param input - Resource ID, page number, note type, and content.
 */
export async function createResourceNoteAction(input: {
  resourceId: number;
  pageNumber: string;
  noteType: NoteType;
  content: string;
}) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    if (!input.content.trim()) {
      return { success: false, error: "Lütfen not metnini giriniz." };
    }

    const [newNote] = await db
      .insert(libraryResourceNotes)
      .values({
        libraryResourceId: input.resourceId,
        userId: session.userId,
        pageNumber: input.pageNumber.trim(),
        noteType: input.noteType,
        content: input.content.trim(),
        sentToCardIndex: true,
      })
      .returning();

    log.info("create_resource_note_success", {
      service: "library",
      data: { noteId: newNote.id, resourceId: input.resourceId },
    });

    return {
      success: true,
      data: {
        id: newNote.id,
        resourceId: newNote.libraryResourceId,
        pageNumber: newNote.pageNumber,
        noteType: newNote.noteType as NoteType,
        content: newNote.content,
        sentToCardIndex: newNote.sentToCardIndex,
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
 * @param noteId - Target note ID.
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
      .delete(libraryResourceNotes)
      .where(
        and(
          eq(libraryResourceNotes.id, noteId),
          eq(libraryResourceNotes.userId, session.userId),
        ),
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
