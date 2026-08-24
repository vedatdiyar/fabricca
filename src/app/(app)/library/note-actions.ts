"use server";

import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/core/db";
import { annotations, chunks, outlineAnnotations } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { createFlowId, Logger } from "@/lib/logger";
import { getOwnedSource } from "@/core/services/box/ownership";
import { verifyResourceNote } from "./_services/note-verifier";
import type {
  NoteType,
  NoteVerificationData,
  NoteVerificationStatus,
} from "./_lib/types";

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
  outlineId: z.number().int().positive().optional(),
});

/** Validation schema for updating an existing note. */
const updateResourceNoteSchema = z.object({
  noteId: z.number().int().positive("Geçerli bir not seçilmelidir."),
  pageNumber: z.string().min(1).optional(),
  noteType: noteTypeSchema.optional(),
  content: z.string().trim().min(1).optional(),
  comment: z.string().trim().max(4000).optional(),
});

/**
 * Server Action: Creates a new note / page-numbered citation linked to a library resource,
 * and automatically verifies page & text accuracy against source chunks in the background.
 *
 * @param input - The note data to create.
 * @param input.resourceId - The ID of the resource the note is linked to.
 * @param input.pageNumber - The page number the note refers to.
 * @param input.noteType - The type of the note.
 * @param input.content - The note text.
 * @param input.comment - Optional personal meta-comment / annotation attached to the note.
 * @param input.outlineId - Optional outline section ID to link this citation card to.
 * @returns The created note data with verification result on success, or an error message on failure.
 */
export async function createResourceNoteAction(input: {
  resourceId: number;
  pageNumber: string;
  noteType: NoteType;
  content: string;
  comment?: string;
  outlineId?: number;
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

    // 1. Initial insert into annotations
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
        verificationStatus: "PENDING",
      })
      .returning();

    // 2. If outlineId was provided, link note directly to the outline section
    if (valid.outlineId) {
      try {
        await db.insert(outlineAnnotations).values({
          outlineId: valid.outlineId,
          annotationId: newNote.id,
        });
      } catch (linkErr) {
        log.error("outline_annotation_link_failed", {
          service: "library",
          error: linkErr,
        });
      }
    }

    // 3. Query source chunks to verify grounding & page consistency
    const sourceChunks = await db.query.chunks.findMany({
      where: eq(chunks.sourceId, valid.resourceId),
      columns: {
        content: true,
        pageNumber: true,
      },
      limit: 15,
    });

    let verificationResult: NoteVerificationData | null = null;
    let status: NoteVerificationStatus = "UNVERIFIED";

    try {
      verificationResult = await verifyResourceNote({
        note: {
          content: valid.content,
          pageNumber: valid.pageNumber,
          noteType: valid.noteType,
          comment: comment ?? undefined,
        },
        source: {
          title: owned.source.title,
          authors: owned.source.authors ?? undefined,
          publicationYear: owned.source.publicationYear,
        },
        relevantChunks: sourceChunks,
        logger: log,
      });

      status = verificationResult.status;

      await db
        .update(annotations)
        .set({
          verificationStatus: status,
          verificationData: verificationResult,
          updatedAt: new Date(),
        })
        .where(eq(annotations.id, newNote.id));
    } catch (verifErr) {
      log.error("note_verification_step_error", {
        service: "library",
        error: verifErr,
      });
    }

    log.info("create_resource_note_success", {
      service: "library",
      data: {
        noteId: newNote.id,
        resourceId: valid.resourceId,
        outlineId: valid.outlineId,
        verificationStatus: status,
      },
    });

    revalidatePath("/thesis-architecture");
    revalidatePath("/citation-cards");
    revalidatePath("/library");

    return {
      success: true,
      data: {
        id: newNote.id,
        resourceId: newNote.sourceId,
        pageNumber: newNote.pageNumber,
        noteType: newNote.noteType as NoteType,
        content: newNote.content,
        comment: newNote.comment ?? undefined,
        outlineIds: valid.outlineId ? [valid.outlineId] : [],
        sentToCitationCards: newNote.sentToCitationCards,
        verificationStatus: status,
        verificationData: verificationResult ?? undefined,
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
 * Server Action: Updates an existing note and optionally re-verifies it.
 *
 * @param input - Note ID and fields to update.
 * @returns The updated note on success.
 */
export async function updateResourceNoteAction(input: {
  noteId: number;
  pageNumber?: string;
  noteType?: NoteType;
  content?: string;
  comment?: string;
}) {
  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    const parsed = updateResourceNoteSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Geçersiz veri." };
    }

    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const existing = await db.query.annotations.findFirst({
      where: and(
        eq(annotations.id, parsed.data.noteId),
        eq(annotations.userId, session.userId),
      ),
    });

    if (!existing) {
      return { success: false, error: "Not bulunamadı." };
    }

    const newPageNumber = parsed.data.pageNumber ?? existing.pageNumber;
    const newNoteType = parsed.data.noteType ?? (existing.noteType as NoteType);
    const newContent = parsed.data.content ?? existing.content;
    const newComment =
      parsed.data.comment !== undefined
        ? parsed.data.comment
        : existing.comment;

    const [updated] = await db
      .update(annotations)
      .set({
        pageNumber: newPageNumber,
        noteType: newNoteType,
        content: newContent,
        comment: newComment || null,
        verificationStatus: "VERIFIED",
        updatedAt: new Date(),
      })
      .where(eq(annotations.id, existing.id))
      .returning();

    log.info("update_resource_note_success", {
      service: "library",
      data: { noteId: updated.id },
    });

    return {
      success: true,
      data: {
        id: updated.id,
        resourceId: updated.sourceId,
        pageNumber: updated.pageNumber,
        noteType: updated.noteType as NoteType,
        content: updated.content,
        comment: updated.comment ?? undefined,
        sentToCitationCards: updated.sentToCitationCards,
        verificationStatus:
          updated.verificationStatus as NoteVerificationStatus,
        verificationData: updated.verificationData ?? undefined,
        createdAt: updated.createdAt.toISOString(),
      },
    };
  } catch (err) {
    log.error("update_resource_note_failed", {
      service: "library",
      error: err,
    });
    return { success: false, error: "Not güncellenirken bir hata oluştu." };
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
