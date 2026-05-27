"use server";

import { db } from "@/db";
import { notes, references, thesisCore, thesisBoxes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateEmbedding } from "../_services/embedding.service";
import { generateNoteSuggestions } from "../_services/metadata.service";

export interface SaveNoteResult {
  success: boolean;
  error?: string;
  noteId?: number;
}

export interface GetNotesResult {
  success: boolean;
  error?: string;
  notes?: Array<{
    id: number;
    referenceId: number | null;
    content: string;
    aiContextSuggestions: string | null;
    isUserNote: boolean | null;
    boxId: number | null;
    createdAt: Date | null;
  }>;
}

export interface GetThesisBoxesResult {
  success: boolean;
  error?: string;
  boxes?: Array<{
    id: number;
    thesisCoreId: number;
    name: string;
    description: string | null;
    order: number;
    createdAt: Date | null;
  }>;
}

/**
 * Server Action to save a reading note linked to a specific reference.
 * Generates actual 1536-dimensional embedding using gemini-embedding-2.
 */
export async function saveNoteAction(
  referenceId: number,
  content: string,
): Promise<SaveNoteResult> {
  try {
    if (!content || !content.trim()) {
      return { success: false, error: "Not içeriği boş olamaz." };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        success: false,
        error:
          "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
      };
    }

    // Generate actual 1536-dimensional embedding using gemini-embedding-2
    const embeddingVector = await generateEmbedding(content.trim());

    // Load active thesis constitution and reference document metadata for context
    const [core] = await db.select().from(thesisCore).limit(1);
    const [ref] = await db
      .select()
      .from(references)
      .where(eq(references.id, referenceId))
      .limit(1);

    let aiContextSuggestions: string | null = null;

    try {
      aiContextSuggestions = await generateNoteSuggestions(content, core, ref);
    } catch (geminiErr) {
      console.error(
        "Failed to generate AI context suggestions for note:",
        geminiErr,
      );
    }

    const [newNote] = await db
      .insert(notes)
      .values({
        referenceId,
        content: content.trim(),
        embedding: embeddingVector,
        aiContextSuggestions,
      })
      .returning();

    return {
      success: true,
      noteId: newNote.id,
    };
  } catch (error) {
    console.error("Save Note Error: ", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Not kaydedilirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to fetch all notes associated with a given reference.
 */
export async function getNotesAction(
  referenceId: number,
): Promise<GetNotesResult> {
  try {
    const allNotes = await db
      .select({
        id: notes.id,
        referenceId: notes.referenceId,
        content: notes.content,
        aiContextSuggestions: notes.aiContextSuggestions,
        boxId: notes.boxId,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(eq(notes.referenceId, referenceId))
      .orderBy(notes.createdAt);

    const notesWithUserFlag = allNotes.map((n) => ({
      id: n.id,
      referenceId: n.referenceId,
      content: n.content,
      aiContextSuggestions: n.aiContextSuggestions,
      isUserNote: true,
      boxId: n.boxId,
      createdAt: n.createdAt,
    }));

    return {
      success: true,
      notes: notesWithUserFlag,
    };
  } catch (error) {
    console.error("Get Notes Error: ", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Notlar listelenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to fetch all thesis boxes.
 */
export async function getThesisBoxesAction(): Promise<GetThesisBoxesResult> {
  try {
    const allBoxes = await db
      .select()
      .from(thesisBoxes)
      .orderBy(thesisBoxes.order);

    return {
      success: true,
      boxes: allBoxes,
    };
  } catch (error) {
    console.error("Get Thesis Boxes Error: ", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tematik kutular listelenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action to update the boxId of a specific reading note.
 * Toggles boxId to null if the note is already classified inside this box.
 */
export async function updateNoteBoxAction(
  noteId: number,
  boxId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const [existingNote] = await db
      .select({ boxId: notes.boxId })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!existingNote) {
      return { success: false, error: "Not bulunamadı." };
    }

    const newBoxId = existingNote.boxId === boxId ? null : boxId;

    await db.update(notes).set({ boxId: newBoxId }).where(eq(notes.id, noteId));

    return { success: true };
  } catch (error) {
    console.error("Update Note Box Error: ", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Not kutusu güncellenirken bir hata oluştu.",
    };
  }
}

export interface GetAllNotesWithReferencesResult {
  success: boolean;
  error?: string;
  notes?: Array<{
    id: number;
    referenceId: number | null;
    content: string;
    aiContextSuggestions: string | null;
    boxId: number | null;
    createdAt: Date | null;
    referenceTitle: string | null;
    referenceAuthors: string | null;
    referenceYear: number | null;
  }>;
}

/**
 * Server Action to fetch all reading notes with associated reference metadata.
 */
export async function getAllNotesWithReferencesAction(): Promise<GetAllNotesWithReferencesResult> {
  try {
    const allNotes = await db
      .select({
        id: notes.id,
        referenceId: notes.referenceId,
        content: notes.content,
        aiContextSuggestions: notes.aiContextSuggestions,
        boxId: notes.boxId,
        createdAt: notes.createdAt,
        referenceTitle: references.title,
        referenceAuthors: references.authors,
        referenceYear: references.year,
      })
      .from(notes)
      .leftJoin(references, eq(notes.referenceId, references.id))
      .orderBy(notes.createdAt);

    return {
      success: true,
      notes: allNotes,
    };
  } catch (error) {
    console.error("Get All Notes Error: ", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Notlar ve künyeleri listelenirken bir hata oluştu.",
    };
  }
}
