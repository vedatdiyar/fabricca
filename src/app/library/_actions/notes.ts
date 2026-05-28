"use server";

import { db } from "@/db";
import { notes, references, thesisCore, thesisBoxes } from "@/db/schema";
import { eq, and, isNotNull, ne, like } from "drizzle-orm";
import { generateEmbedding } from "../_services/embedding.service";
import { generateNoteSuggestions } from "../_services/metadata.service";

export interface SaveNoteResult {
  success: boolean;
  error?: string;
  noteId?: number;
}

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

/**
 * Helper function to build single composite Markdown text from structured note fields.
 * This guarantees backward compatibility and excellent RAG embedding representation.
 */
function buildNoteContent(params: {
  mainArgument?: string | null;
  quotes?: string | null;
  concepts?: string | null;
  criticalNotes?: string | null;
  connections?: string | null;
  researchNotes?: string | null;
  memoryAnchors?: string | null;
  content?: string | null;
}): string {
  const parts: string[] = [];

  if (params.mainArgument && params.mainArgument.trim()) {
    parts.push(`### Ana Argüman\n${params.mainArgument.trim()}`);
  }
  if (params.quotes && params.quotes.trim()) {
    parts.push(`### Önemli Alıntılar\n${params.quotes.trim()}`);
  }
  if (params.concepts && params.concepts.trim()) {
    parts.push(`### Kavramlar ve Temalar\n${params.concepts.trim()}`);
  }
  if (params.criticalNotes && params.criticalNotes.trim()) {
    parts.push(`### Eleştirel Not\n${params.criticalNotes.trim()}`);
  }
  if (params.connections && params.connections.trim()) {
    parts.push(`### Diğer Metinlerle Bağlantı\n${params.connections.trim()}`);
  }
  if (params.researchNotes && params.researchNotes.trim()) {
    parts.push(`### Araştırmam İçin Not\n${params.researchNotes.trim()}`);
  }
  if (params.memoryAnchors && params.memoryAnchors.trim()) {
    parts.push(`### Hafıza Notu\n${params.memoryAnchors.trim()}`);
  }

  if (parts.length === 0 && params.content && params.content.trim()) {
    return params.content.trim();
  }

  return parts.join("\n\n");
}

/**
 * Server Action to save a reading note linked to a specific reference.
 * Supports both structured academic fields and flat content for total backward compatibility.
 */
export async function saveNoteAction(
  referenceId: number,
  contentOrParams:
    | string
    | {
        mainArgument?: string;
        quotes?: string;
        concepts?: string;
        criticalNotes?: string;
        connections?: string;
        researchNotes?: string;
        memoryAnchors?: string;
        content?: string;
      },
  boxId?: number | null,
): Promise<SaveNoteResult> {
  try {
    let mainArgument = "";
    let quotes = "";
    let concepts = "";
    let criticalNotes = "";
    let connections = "";
    let researchNotes = "";
    let memoryAnchors = "";
    let rawContent = "";

    if (typeof contentOrParams === "string") {
      rawContent = contentOrParams;
    } else {
      mainArgument = contentOrParams.mainArgument || "";
      quotes = contentOrParams.quotes || "";
      concepts = contentOrParams.concepts || "";
      criticalNotes = contentOrParams.criticalNotes || "";
      connections = contentOrParams.connections || "";
      researchNotes = contentOrParams.researchNotes || "";
      memoryAnchors = contentOrParams.memoryAnchors || "";
      rawContent = contentOrParams.content || "";
    }

    const finalContent = buildNoteContent({
      mainArgument,
      quotes,
      concepts,
      criticalNotes,
      connections,
      researchNotes,
      memoryAnchors,
      content: rawContent,
    });

    if (!finalContent || !finalContent.trim()) {
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
    const embeddingVector = await generateEmbedding(finalContent.trim());

    // Load active thesis constitution and reference document metadata for context
    const [core] = await db.select().from(thesisCore).limit(1);
    const [ref] = await db
      .select()
      .from(references)
      .where(eq(references.id, referenceId))
      .limit(1);

    let aiContextSuggestions: string | null = null;

    try {
      aiContextSuggestions = await generateNoteSuggestions(
        finalContent,
        core,
        ref,
      );
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
        content: finalContent.trim(),
        embedding: embeddingVector,
        aiContextSuggestions,
        boxId: boxId || null,
        mainArgument: mainArgument || null,
        quotes: quotes || null,
        concepts: concepts || null,
        criticalNotes: criticalNotes || null,
        connections: connections || null,
        researchNotes: researchNotes || null,
        memoryAnchors: memoryAnchors || null,
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

export interface UpdateNoteParams {
  noteId: number;
  boxId?: number | null;
  mainArgument?: string;
  quotes?: string;
  concepts?: string;
  criticalNotes?: string;
  connections?: string;
  researchNotes?: string;
  memoryAnchors?: string;
  content?: string;
}

/**
 * Server Action to update a structured reading note.
 * Automatically rebuilds composite content and recalculates the embedding vector.
 */
export async function updateNoteAction(
  params: UpdateNoteParams,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { noteId, boxId, ...fields } = params;

    const [existingNote] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!existingNote) {
      return { success: false, error: "Not bulunamadı." };
    }

    // Merge existing fields with new updates to construct correct new composite content
    const merged = {
      mainArgument:
        fields.mainArgument !== undefined
          ? fields.mainArgument
          : existingNote.mainArgument,
      quotes: fields.quotes !== undefined ? fields.quotes : existingNote.quotes,
      concepts:
        fields.concepts !== undefined ? fields.concepts : existingNote.concepts,
      criticalNotes:
        fields.criticalNotes !== undefined
          ? fields.criticalNotes
          : existingNote.criticalNotes,
      connections:
        fields.connections !== undefined
          ? fields.connections
          : existingNote.connections,
      researchNotes:
        fields.researchNotes !== undefined
          ? fields.researchNotes
          : existingNote.researchNotes,
      memoryAnchors:
        fields.memoryAnchors !== undefined
          ? fields.memoryAnchors
          : existingNote.memoryAnchors,
      content:
        fields.content !== undefined ? fields.content : existingNote.content,
    };

    const finalContent = buildNoteContent(merged);

    if (!finalContent || !finalContent.trim()) {
      return { success: false, error: "Not içeriği boş olamaz." };
    }

    // Recalculate embedding with gemini-embedding-2
    const embeddingVector = await generateEmbedding(finalContent.trim());

    // Regenerate AI suggestions based on updated content
    const [core] = await db.select().from(thesisCore).limit(1);
    const [ref] = await db
      .select()
      .from(references)
      .where(eq(references.id, existingNote.referenceId || 0))
      .limit(1);

    let aiContextSuggestions = existingNote.aiContextSuggestions;
    try {
      aiContextSuggestions = await generateNoteSuggestions(
        finalContent,
        core,
        ref,
      );
    } catch (geminiErr) {
      console.error("Failed to regenerate AI context suggestions:", geminiErr);
    }

    // Update database record
    await db
      .update(notes)
      .set({
        content: finalContent.trim(),
        embedding: embeddingVector,
        aiContextSuggestions,
        boxId: boxId !== undefined ? boxId : existingNote.boxId,
        mainArgument: merged.mainArgument || null,
        quotes: merged.quotes || null,
        concepts: merged.concepts || null,
        criticalNotes: merged.criticalNotes || null,
        connections: merged.connections || null,
        researchNotes: merged.researchNotes || null,
        memoryAnchors: merged.memoryAnchors || null,
      })
      .where(eq(notes.id, noteId));

    return { success: true };
  } catch (error) {
    console.error("Update Note Error: ", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Not güncellenirken bir hata oluştu.",
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

type AcademicField =
  | "mainArgument"
  | "quotes"
  | "concepts"
  | "criticalNotes"
  | "connections"
  | "researchNotes"
  | "memoryAnchors";

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
