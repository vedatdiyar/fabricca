"use server";

import { db } from "@/db";
import { notes, references, thesisCore } from "@/db/schema";
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
