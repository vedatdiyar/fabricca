"use server";

import { db } from "@/db";
import { notes, references, thesisBoxes } from "@/db/schema";
import { eq, and, isNotNull, ne, like } from "drizzle-orm";

export interface NoteType {
  id: number;
  referenceId: number | null;
  content: string;
  aiContextSuggestions: string | null;
  boxId: number | null;
  mainArgument: string | null;
  quotes: string | null;
  concepts: string | null;
  criticalNotes: string | null;
  connections: string | null;
  researchNotes: string | null;
  memoryAnchors: string | null;
  isUserNote: boolean | null;
  createdAt: Date | null;
}

export interface GetNotesResult {
  success: boolean;
  error?: string;
  notes?: Array<NoteType>;
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

export interface GetAllNotesWithReferencesResult {
  success: boolean;
  error?: string;
  notes?: Array<{
    id: number;
    referenceId: number | null;
    content: string;
    aiContextSuggestions: string | null;
    boxId: number | null;
    mainArgument: string | null;
    quotes: string | null;
    concepts: string | null;
    criticalNotes: string | null;
    connections: string | null;
    researchNotes: string | null;
    memoryAnchors: string | null;
    createdAt: Date | null;
    referenceTitle: string | null;
    referenceAuthors: string | null;
    referenceYear: number | null;
  }>;
}

export type AcademicField =
  | "mainArgument"
  | "quotes"
  | "concepts"
  | "criticalNotes"
  | "connections"
  | "researchNotes"
  | "memoryAnchors";

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
        mainArgument: notes.mainArgument,
        quotes: notes.quotes,
        concepts: notes.concepts,
        criticalNotes: notes.criticalNotes,
        connections: notes.connections,
        researchNotes: notes.researchNotes,
        memoryAnchors: notes.memoryAnchors,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(eq(notes.referenceId, referenceId))
      .orderBy(notes.createdAt);

    const notesWithUserFlag = allNotes.map((n) => ({
      ...n,
      isUserNote: true,
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
        mainArgument: notes.mainArgument,
        quotes: notes.quotes,
        concepts: notes.concepts,
        criticalNotes: notes.criticalNotes,
        connections: notes.connections,
        researchNotes: notes.researchNotes,
        memoryAnchors: notes.memoryAnchors,
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

/**
 * Server Action to fetch notes that have a non-empty, non-null value in a specific structured field.
 * This is useful for building filtered academic dashboards or export pipelines.
 */
export async function getNotesByFieldAction(
  referenceId: number,
  field: AcademicField,
): Promise<GetNotesResult> {
  try {
    const filteredNotes = await db
      .select({
        id: notes.id,
        referenceId: notes.referenceId,
        content: notes.content,
        aiContextSuggestions: notes.aiContextSuggestions,
        boxId: notes.boxId,
        mainArgument: notes.mainArgument,
        quotes: notes.quotes,
        concepts: notes.concepts,
        criticalNotes: notes.criticalNotes,
        connections: notes.connections,
        researchNotes: notes.researchNotes,
        memoryAnchors: notes.memoryAnchors,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(
        and(
          eq(notes.referenceId, referenceId),
          isNotNull(notes[field]),
          ne(notes[field], ""),
        ),
      )
      .orderBy(notes.createdAt);

    const notesWithUserFlag = filteredNotes.map((n) => ({
      ...n,
      isUserNote: true,
    }));

    return {
      success: true,
      notes: notesWithUserFlag,
    };
  } catch (error) {
    console.error(`Get Notes By Field (${field}) Error: `, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `${field} alanına göre notlar listelenirken bir hata oluştu.`,
    };
  }
}

/**
 * Server Action to search within a specific structured academic field.
 */
export async function searchNotesByFieldAction(
  query: string,
  field: AcademicField,
): Promise<GetNotesResult> {
  try {
    if (!query || !query.trim()) {
      return { success: true, notes: [] };
    }

    const filteredNotes = await db
      .select({
        id: notes.id,
        referenceId: notes.referenceId,
        content: notes.content,
        aiContextSuggestions: notes.aiContextSuggestions,
        boxId: notes.boxId,
        mainArgument: notes.mainArgument,
        quotes: notes.quotes,
        concepts: notes.concepts,
        criticalNotes: notes.criticalNotes,
        connections: notes.connections,
        researchNotes: notes.researchNotes,
        memoryAnchors: notes.memoryAnchors,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(like(notes[field], `%${query.trim()}%`))
      .orderBy(notes.createdAt);

    const notesWithUserFlag = filteredNotes.map((n) => ({
      ...n,
      isUserNote: true,
    }));

    return {
      success: true,
      notes: notesWithUserFlag,
    };
  } catch (error) {
    console.error(`Search Notes By Field (${field}) Error: `, error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `${field} alanında arama yapılırken bir hata oluştu.`,
    };
  }
}
