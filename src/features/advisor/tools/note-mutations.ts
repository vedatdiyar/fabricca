import { db } from "@/db";
import { annotations, type Annotation } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { MutationToolHandler, MutationToolResult } from "./mutation-types";
import { toNumericId } from "./mutation-types";

/**
 * Captures the current annotation fields for the undo preview.
 *
 * @param args - The proposed mutation arguments.
 * @returns The existing annotation field values, or undefined.
 */
async function getNotePreviousState(
  args: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  const noteId = toNumericId(args.noteId);
  if (!noteId) return undefined;
  const noteItem = await db.query.annotations.findFirst({
    where: eq(annotations.id, noteId),
  });
  if (!noteItem) return undefined;
  return {
    content: noteItem.content,
    pageNumber: noteItem.pageNumber ?? "",
  };
}

/**
 * Creates a new note/annotation attached to a source.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The creation result.
 */
async function executeAddNote(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const sourceId = args.sourceId as number;
  const pageNumber = args.pageNumber as string;
  const noteType = args.noteType as Annotation["noteType"];
  const content = args.content as string;
  const comment = (args.comment as string | undefined) ?? null;

  const [newNote] = await db
    .insert(annotations)
    .values({
      sourceId,
      userId,
      pageNumber,
      noteType,
      content,
      comment,
    })
    .returning();

  return {
    success: true,
    message: "Not ve alıntı kütüphanenize eklendi.",
    data: newNote,
  };
}

/**
 * Deletes an annotation owned by the user.
 *
 * @param args - The proposed mutation arguments.
 * @param userId - Authenticated user ID.
 * @returns The deletion result with the captured previous state.
 */
async function executeDeleteNote(
  args: Record<string, unknown>,
  userId: number,
): Promise<MutationToolResult> {
  const noteId = args.noteId as number;
  const existingNote = await db.query.annotations.findFirst({
    where: and(eq(annotations.id, noteId), eq(annotations.userId, userId)),
  });
  if (!existingNote) {
    return { success: false, error: "Silinecek not bulunamadı." };
  }

  const previousState: Record<string, unknown> = {
    sourceId: existingNote.sourceId,
    pageNumber: existingNote.pageNumber,
    noteType: existingNote.noteType,
    content: existingNote.content,
    comment: existingNote.comment,
    sentToCitationCards: existingNote.sentToCitationCards,
  };

  await db
    .delete(annotations)
    .where(and(eq(annotations.id, noteId), eq(annotations.userId, userId)));

  return { success: true, message: "Not silindi.", previousState };
}

/** Mutation handlers for the note/annotation tools. */
export const noteMutations: Record<string, MutationToolHandler> = {
  addNote: {
    execute: executeAddNote,
    getPreviousState: async () => undefined,
  },
  deleteNote: {
    execute: executeDeleteNote,
    getPreviousState: getNotePreviousState,
  },
};
