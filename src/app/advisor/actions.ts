"use server";

import { db } from "@/db";
import {
  references,
  pdfChunks,
  thesisCore,
  thesisBoxes,
  notes,
} from "@/db/schema";
import { inArray, sql, and } from "drizzle-orm";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { generateContentWithRetry } from "@/lib/gemini";
import {
  getAdvisorSystemInstruction,
  getAdvisorTools,
} from "./_services/prompt-templates";

export interface ChatMessage {
  role: "user" | "assistant" | "model";
  content: string;
  functionCall?: {
    name: string;
    args: unknown;
    id: string;
    thoughtSignature?: string;
  };
  functionResponse?: {
    name: string;
    response: unknown;
    id: string;
  };
}

export interface CitationSource {
  id: number;
  index: number;
  referenceId: number | null;
  title: string;
  content: string;
  score: number;
}

/**
 * Hybrid Reasoning Server Action:
 * 1. Generates 1536-dim embedding of user query
 * 2. Similarity search in pdf_chunks using pgvector cosine distance
 * 3. Applies strict threshold (similarity >= 0.25)
 * 4. Calls gemini-3.1-flash-lite with system instructions and chat history
 */
export async function sendMessageAction(
  message: string,
  chatHistory: ChatMessage[],
  selectedReferenceIds: number[],
): Promise<{
  success: boolean;
  response?: string;
  sources?: CitationSource[];
  functionCall?: {
    name: string;
    args: unknown;
    id: string;
    thoughtSignature?: string;
  };
  error?: string;
}> {
  try {
    // message can be empty if we are sending a functionResponse follow-up
    const isNormalMessage = message && message.trim().length > 0;

    // Fetch active Thesis Core (Thesis constitution) dynamically
    const [core] = await db.select().from(thesisCore).limit(1);
    const thesisTitle = core?.title || "Belirtilmemiş";
    const thesisQuestion = core?.researchQuestion || "Belirtilmemiş";
    const thesisArgument = core?.argument || "Belirtilmemiş";
    const thesisMethodology = core?.methodology || "Belirtilmemiş";

    // Fetch active thesis boxes to inject valid IDs and descriptions into the system prompt
    const boxesList = await db
      .select({
        id: thesisBoxes.id,
        name: thesisBoxes.name,
        description: thesisBoxes.description,
      })
      .from(thesisBoxes)
      .orderBy(thesisBoxes.order);

    const boxesInfoText = boxesList
      .map(
        (b) =>
          `- Kutu ID: ${b.id}, Bölüm Adı: "${b.name}", Mevcut İçerik/Açıklama: "${b.description || "Boş"}"`,
      )
      .join("\n");

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        success: false,
        error:
          "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
      };
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Step 1: Generate actual 1536-dimensional embedding of the user's message (only if normal query)
    let embeddingVector: number[] = [];
    if (isNormalMessage) {
      try {
        const embedResponse = await ai.models.embedContent({
          model: "gemini-embedding-2",
          contents: message.trim(),
          config: {
            outputDimensionality: 1536,
          },
        });
        embeddingVector = embedResponse.embeddings?.[0]?.values || [];
      } catch (embedErr) {
        console.error("Gemini Embedding Generation Error:", embedErr);
        return {
          success: false,
          error: `Aramada kullanılmak üzere embedding üretilemedi: ${embedErr instanceof Error ? embedErr.message : "Bilinmeyen hata"}`,
        };
      }
    }

    // Step 2: Drizzle ORM similarity search using cosine similarity (only for normal queries with embedding)
    let similarChunks: Array<{
      id: number;
      content: string;
      referenceId: number | null;
      similarity: number;
    }> = [];

    let similarNotes: Array<{
      id: number;
      criticalNotes: string | null;
      connections: string | null;
      referenceId: number | null;
      similarity: number;
    }> = [];

    if (isNormalMessage && embeddingVector.length === 1536) {
      try {
        const targetEmbeddingStr = JSON.stringify(embeddingVector);
        const chunkSimilaritySql = sql<number>`1 - (${pdfChunks.embedding} <=> ${targetEmbeddingStr}::vector)`;
        const notesSimilaritySql = sql<number>`1 - (${notes.embedding} <=> ${targetEmbeddingStr}::vector)`;

        // Perform parallel pgvector cosine similarity search on both tables
        const hasSelection =
          selectedReferenceIds && selectedReferenceIds.length > 0;

        const chunksQuery = hasSelection
          ? db
              .select({
                id: pdfChunks.id,
                content: pdfChunks.content,
                referenceId: pdfChunks.referenceId,
                similarity: chunkSimilaritySql,
              })
              .from(pdfChunks)
              .where(inArray(pdfChunks.referenceId, selectedReferenceIds))
              .orderBy(
                sql`${pdfChunks.embedding} <=> ${targetEmbeddingStr}::vector`,
              )
              .limit(5)
          : db
              .select({
                id: pdfChunks.id,
                content: pdfChunks.content,
                referenceId: pdfChunks.referenceId,
                similarity: chunkSimilaritySql,
              })
              .from(pdfChunks)
              .orderBy(
                sql`${pdfChunks.embedding} <=> ${targetEmbeddingStr}::vector`,
              )
              .limit(5);

        const notesQuery = hasSelection
          ? db
              .select({
                id: notes.id,
                criticalNotes: notes.criticalNotes,
                connections: notes.connections,
                referenceId: notes.referenceId,
                similarity: notesSimilaritySql,
              })
              .from(notes)
              .where(
                and(
                  inArray(notes.referenceId, selectedReferenceIds),
                  sql`${notes.embedding} IS NOT NULL`,
                ),
              )
              .orderBy(
                sql`${notes.embedding} <=> ${targetEmbeddingStr}::vector`,
              )
              .limit(5)
          : db
              .select({
                id: notes.id,
                criticalNotes: notes.criticalNotes,
                connections: notes.connections,
                referenceId: notes.referenceId,
                similarity: notesSimilaritySql,
              })
              .from(notes)
              .where(sql`${notes.embedding} IS NOT NULL`)
              .orderBy(
                sql`${notes.embedding} <=> ${targetEmbeddingStr}::vector`,
              )
              .limit(5);

        const [chunkRes, notesRes] = await Promise.all([
          chunksQuery,
          notesQuery,
        ]);
        similarChunks = chunkRes;
        similarNotes = notesRes;
      } catch (dbErr) {
        console.error(
          "Postgres/pgvector hybrid similarity query error:",
          dbErr,
        );
        similarChunks = [];
        similarNotes = [];
      }
    }

    // Step 3: Filter chunks and notes by a strict relevance threshold of 0.25
    const relevantChunks = similarChunks
      .filter((chunk) => chunk.similarity >= 0.25)
      .map((chunk, idx) => ({
        ...chunk,
        index: idx + 1,
      }));

    const relevantNotes = similarNotes
      .filter(
        (note) =>
          note.similarity >= 0.25 &&
          ((note.criticalNotes && note.criticalNotes.trim().length > 0) ||
            (note.connections && note.connections.trim().length > 0)),
      )
      .map((note, idx) => ({
        ...note,
        index: idx + 1,
      }));

    // Get the reference titles for the sources return, including original text content
    let sourceReferenceInfos: CitationSource[] = [];
    const uniqueRefIds = Array.from(
      new Set(
        [
          ...relevantChunks.map((c) => c.referenceId),
          ...relevantNotes.map((n) => n.referenceId),
        ].filter((id): id is number => id !== null),
      ),
    );

    let refTitleMap = new Map<number, string>();
    if (uniqueRefIds.length > 0) {
      try {
        const refs = await db
          .select({ id: references.id, title: references.title })
          .from(references)
          .where(inArray(references.id, uniqueRefIds));

        refTitleMap = new Map(refs.map((r) => [r.id, r.title]));
      } catch (refErr) {
        console.error(
          "Failed to map reference titles for hybrid search:",
          refErr,
        );
      }
    }

    // Combine chunks and notes as sources for citation popovers to find by ID
    const sourceChunks = relevantChunks.map((c) => ({
      id: c.id,
      referenceId: c.referenceId,
      title: c.referenceId
        ? refTitleMap.get(c.referenceId) || "Bilinmeyen Döküman"
        : "Bilinmeyen Döküman",
      content: c.content,
      score: Number(c.similarity.toFixed(4)),
    }));

    const sourceNotes = relevantNotes.map((n) => {
      const docTitle = n.referenceId ? refTitleMap.get(n.referenceId) : null;
      const titleStr = docTitle
        ? `Kişisel Not - ${docTitle}`
        : "Kişisel Okuma Notu";

      const parts = [];
      if (n.criticalNotes && n.criticalNotes.trim()) {
        parts.push(`[Eleştirel Şerh]: ${n.criticalNotes.trim()}`);
      }
      if (n.connections && n.connections.trim()) {
        parts.push(`[Bağlantılar]: ${n.connections.trim()}`);
      }

      return {
        id: n.id,
        referenceId: n.referenceId,
        title: titleStr,
        content: parts.join("\n"),
        score: Number(n.similarity.toFixed(4)),
      };
    });

    sourceReferenceInfos = [...sourceChunks, ...sourceNotes].map(
      (item, idx) => ({
        ...item,
        index: idx + 1,
      }),
    );

    // Step 4: Build XML Context Text from both pdfChunks and personal notes
    const chunksXml = relevantChunks
      .map((c) => {
        const titleStr = c.referenceId
          ? refTitleMap.get(c.referenceId) || "Bilinmeyen Döküman"
          : "Bilinmeyen Döküman";
        return `<chunk id="${c.id}" referenceId="${c.referenceId || "Bilinmiyor"}" documentTitle="${titleStr}">${c.content}</chunk>`;
      })
      .join("\n\n");

    const notesXml = relevantNotes
      .map((n) => {
        const titleStr = n.referenceId
          ? refTitleMap.get(n.referenceId) || "Bilinmeyen Döküman"
          : "Bilinmeyen Döküman";
        const parts = [];
        if (n.criticalNotes && n.criticalNotes.trim()) {
          parts.push(
            `  <critical_note>${n.criticalNotes.trim()}</critical_note>`,
          );
        }
        if (n.connections && n.connections.trim()) {
          parts.push(`  <connection>${n.connections.trim()}</connection>`);
        }
        return `<chunk id="${n.id}" referenceId="${n.referenceId || "Bilinmiyor"}" documentTitle="${titleStr}" type="personal_note">\n${parts.join("\n")}\n</chunk>`;
      })
      .filter(Boolean)
      .join("\n\n");

    const contextText =
      `<chunks>\n${chunksXml.trim() ? chunksXml : "Eşleşen döküman parçası bulunamadı."}\n</chunks>\n\n` +
      `<personal_critical_notes>\n${notesXml.trim() ? notesXml : "Kişisel okuma notlarında eşleşen eleştirel şerh/bağlantı bulunamadı."}\n</personal_critical_notes>`;

    // Step 5: Construct System Instructions (Prompt) for hybrid reasoning, demanding database ID citations [^X]
    const systemInstruction = getAdvisorSystemInstruction({
      thesisTitle,
      thesisQuestion,
      thesisArgument,
      thesisMethodology,
      boxesInfoText,
    });

    // Step 6: Format Gemini API payload (contents array)
    const contents = chatHistory.map((item) => {
      const role = item.role === "assistant" ? "model" : item.role;
      const parts: Record<string, unknown>[] = [];

      if (item.functionCall) {
        parts.push({
          functionCall: {
            name: item.functionCall.name,
            args: item.functionCall.args,
            id: item.functionCall.id,
          },
          thoughtSignature: item.functionCall.thoughtSignature,
        });
      } else if (item.functionResponse) {
        parts.push({
          functionResponse: {
            name: item.functionResponse.name,
            response: item.functionResponse.response,
            id: item.functionResponse.id,
          },
        });
      } else {
        parts.push({ text: item.content });
      }

      return { role, parts };
    });

    // If it's a normal new message (and not a function response reply), append it formatted with RAG context
    if (isNormalMessage) {
      contents.push({
        role: "user",
        parts: [
          {
            text:
              `Kullanıcı Mesajı: "${message.trim()}"\n\n` +
              `[DANIŞMANA SAĞLANAN AKADEMİK BAĞLAM / RAG CONTEXT]\n` +
              (contextText.trim()
                ? contextText
                : "Erişilebilir veya eşleşen bir kütüphane bağlamı bulunmamaktadır. Kendi genel akademik bilginizle melez akıl yürütme yaparak yanıtlayın."),
          },
        ],
      });
    }

    // Step 7: Suspect box updates to dynamically elevate thinking level
    const userQueryStr = (message || "").toLowerCase();
    const isUpdateSuspected =
      userQueryStr.includes("güncelle") ||
      userQueryStr.includes("değiştir") ||
      userQueryStr.includes("düzelt") ||
      userQueryStr.includes("yaz") ||
      userQueryStr.includes("anayasa") ||
      userQueryStr.includes("kutu") ||
      userQueryStr.includes("bölüm") ||
      userQueryStr.includes("update") ||
      userQueryStr.includes("change") ||
      userQueryStr.includes("modify") ||
      userQueryStr.includes("edit") ||
      userQueryStr.includes("outline");

    const thinkingLevel = isUpdateSuspected
      ? ThinkingLevel.HIGH
      : ThinkingLevel.LOW;

    // Step 8: Call Google Gemini 3.1 Flash Lite via official SDK with retry
    const genAIResponse = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: contents as unknown as {
        role: string;
        parts: { text: string }[];
      }[],
      config: {
        systemInstruction: systemInstruction,
        temperature: 1, // Default stable temperature requested
        thinkingConfig: {
          thinkingLevel: thinkingLevel,
        },
        tools: getAdvisorTools(),
      },
    });

    // Systematically extract both the full text parts and functionCall in a single turn
    let extractedFunctionCall: {
      name: string;
      args: {
        boxId?: number;
        updatedContent?: string;
        updatedMethodology?: string;
        [key: string]: unknown;
      };
      id: string;
      thoughtSignature?: string;
    } | null = null;
    let thoughtSignature: string | undefined = undefined;

    const candidateParts = genAIResponse.candidates?.[0]?.content?.parts;
    if (candidateParts && candidateParts.length > 0) {
      const fcPart = candidateParts.find((p) => !!p.functionCall);
      if (fcPart && fcPart.functionCall) {
        thoughtSignature =
          fcPart.thoughtSignature || (fcPart as Record<string, unknown>).thought_signature as string | undefined;
        extractedFunctionCall = {
          name: fcPart.functionCall.name || "update_thesis_box",
          args: (fcPart.functionCall.args || {}) as { boxId?: number; updatedContent?: string; updatedMethodology?: string },
          id: fcPart.functionCall.id || `call_${Date.now()}`,
          thoughtSignature: thoughtSignature,
        };
      }
    }

    // Fallback to SDK helper functionCalls if parts extraction didn't capture it
    if (
      !extractedFunctionCall &&
      genAIResponse.functionCalls &&
      genAIResponse.functionCalls.length > 0
    ) {
      const call = genAIResponse.functionCalls[0];
      extractedFunctionCall = {
        name: call.name || "update_thesis_box",
        args: (call.args || {}) as { boxId?: number; updatedContent?: string; updatedMethodology?: string },
        id: call.id || `call_${Date.now()}`,
      };
    }

    // Concatenate all text parts to form the clean response text
    let responseText = "";
    if (candidateParts) {
      responseText = candidateParts
        .filter((p) => p.text !== undefined && p.text !== null)
        .map((p) => p.text)
        .join("")
        .trim();
    }
    // Fallback to genAIResponse.text if responseText is still empty
    if (!responseText) {
      responseText = genAIResponse.text || "";
    }

    console.log("[Gemini Response Extracted]", {
      hasText: !!responseText,
      hasFunctionCall: !!extractedFunctionCall,
      fcName: extractedFunctionCall?.name,
    });

    if (extractedFunctionCall) {
      console.log(
        `[Gemini Tool Call] update_thesis_box triggered for boxId: ${extractedFunctionCall.args?.boxId}`,
      );
      return {
        success: true,
        response: responseText,
        functionCall: extractedFunctionCall,
        sources:
          sourceReferenceInfos.length > 0 ? sourceReferenceInfos : undefined,
      };
    }

    if (!responseText) {
      return {
        success: false,
        error: "Yapay zeka motorundan boş bir yanıt döndü.",
      };
    }

    return {
      success: true,
      response: responseText,
      sources:
        sourceReferenceInfos.length > 0 ? sourceReferenceInfos : undefined,
    };
  } catch (error) {
    console.error("sendMessageAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Mesaj işlenirken yapay zeka servisinde bir hata oluştu.",
    };
  }
}
