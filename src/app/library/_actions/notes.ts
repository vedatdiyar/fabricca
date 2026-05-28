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
