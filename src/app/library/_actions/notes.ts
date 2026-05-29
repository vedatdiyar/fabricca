"use server";

import { db } from "@/db";
import { notes, references, thesisCore, pdfChunks } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
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

/**
 * Server Action to explicitly retrigger AI analysis / context suggestions.
 * Recalculates embedding for the note, finds the top 3 semantically closest different sources,
 * and calls Gemini with this semantic context to perform literature mapping/citations.
 */
export async function retriggerAiAnalysisAction(noteId: number): Promise<{
  success: boolean;
  aiContextSuggestions?: string | null;
  error?: string;
}> {
  try {
    const [existingNote] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!existingNote) {
      return { success: false, error: "Not bulunamadı." };
    }

    // 1. Analiz edilecek mevcut notun içeriğini al ve embedding.service.ts kullanarak vektörünü oluştur.
    const embeddingVector = await generateEmbedding(existingNote.content);

    // 2. Veritabanındaki diğer notlar/kaynaklar arasında bir vektör tabanlı benzerlik araması yürüt.
    const targetEmbeddingStr = JSON.stringify(embeddingVector);
    const chunkSimilaritySql = sql<number>`1 - (${pdfChunks.embedding} <=> ${targetEmbeddingStr}::vector)`;
    const notesSimilaritySql = sql<number>`1 - (${notes.embedding} <=> ${targetEmbeddingStr}::vector)`;

    let matchedChunks: Array<{
      content: string;
      referenceId: number | null;
      similarity: number;
      refTitle: string;
      refAuthors: string | null;
      refYear: number | null;
    }> = [];

    let matchedNotes: Array<{
      content: string;
      referenceId: number | null;
      similarity: number;
      refTitle: string;
      refAuthors: string | null;
      refYear: number | null;
    }> = [];

    try {
      // Eşleşen PDF parçalarını ara (kendi referansı dışındakiler)
      matchedChunks = await db
        .select({
          content: pdfChunks.content,
          referenceId: pdfChunks.referenceId,
          similarity: chunkSimilaritySql,
          refTitle: references.title,
          refAuthors: references.authors,
          refYear: references.year,
        })
        .from(pdfChunks)
        .innerJoin(references, eq(pdfChunks.referenceId, references.id))
        .where(
          existingNote.referenceId
            ? sql`${pdfChunks.referenceId} <> ${existingNote.referenceId}`
            : undefined,
        )
        .orderBy(sql`${pdfChunks.embedding} <=> ${targetEmbeddingStr}::vector`)
        .limit(15);
    } catch (chunkErr) {
      console.error("Similarity search in pdfChunks error: ", chunkErr);
    }

    try {
      // Eşleşen notları ara (kendi referansı dışındakiler)
      matchedNotes = await db
        .select({
          content: notes.content,
          referenceId: notes.referenceId,
          similarity: notesSimilaritySql,
          refTitle: references.title,
          refAuthors: references.authors,
          refYear: references.year,
        })
        .from(notes)
        .innerJoin(references, eq(notes.referenceId, references.id))
        .where(
          and(
            existingNote.referenceId
              ? sql`${notes.referenceId} <> ${existingNote.referenceId}`
              : undefined,
            sql`${notes.embedding} IS NOT NULL`,
          ),
        )
        .orderBy(sql`${notes.embedding} <=> ${targetEmbeddingStr}::vector`)
        .limit(15);
    } catch (noteErr) {
      console.error("Similarity search in notes error: ", noteErr);
    }

    // 3. Semantik olarak en yakın ilk 3 farklı kaynağın metadatasını ayıkla
    interface SourceItem {
      referenceId: number;
      authors: string | null;
      year: number | null;
      title: string;
      shortContent: string;
      similarity: number;
    }

    const allMatches: SourceItem[] = [];

    for (const c of matchedChunks) {
      if (c.referenceId) {
        allMatches.push({
          referenceId: c.referenceId,
          authors: c.refAuthors,
          year: c.refYear,
          title: c.refTitle,
          shortContent: c.content,
          similarity: c.similarity,
        });
      }
    }

    for (const n of matchedNotes) {
      if (n.referenceId) {
        allMatches.push({
          referenceId: n.referenceId,
          authors: n.refAuthors,
          year: n.refYear,
          title: n.refTitle,
          shortContent: n.content,
          similarity: n.similarity,
        });
      }
    }

    // Sırala
    allMatches.sort((a, b) => b.similarity - a.similarity);

    // Tekilleştir
    const uniqueSourcesMap = new Map<number, SourceItem>();
    for (const item of allMatches) {
      if (!uniqueSourcesMap.has(item.referenceId)) {
        uniqueSourcesMap.set(item.referenceId, item);
      }
    }

    const top3Sources = Array.from(uniqueSourcesMap.values()).slice(0, 3);

    const [core] = await db.select().from(thesisCore).limit(1);
    const [ref] = await db
      .select()
      .from(references)
      .where(eq(references.id, existingNote.referenceId || 0))
      .limit(1);

    // 4. Gemini'a bağlam (context) olarak besle ve suggestion üret
    const aiContextSuggestions = await generateNoteSuggestions(
      existingNote.content,
      core,
      ref,
      top3Sources,
    );

    // Bu süreçte, note'un kendi embedding'ini ve AI çıktısını veritabanında güncelleyelim
    await db
      .update(notes)
      .set({
        embedding: embeddingVector,
        aiContextSuggestions,
      })
      .where(eq(notes.id, noteId));

    return { success: true, aiContextSuggestions };
  } catch (error) {
    console.error("Retrigger AI Analysis Error: ", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Yapay zeka analizi yeniden tetiklenirken bir hata oluştu.",
    };
  }
}
