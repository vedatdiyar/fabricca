"use server";

import { db } from "@/db";
import { references, pdfChunks, aiInsights } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

export interface ReferenceItem {
  id: number;
  title: string;
  authors: string | null;
  year: number | null;
  doi: string | null;
  abstract: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant" | "model";
  content: string;
}

/**
 * Server Action to fetch all references for the list selection in Dijital Danışman Odası
 */
export async function getLibraryReferencesAction(): Promise<{
  success: boolean;
  references?: ReferenceItem[];
  error?: string;
}> {
  try {
    const allRefs = await db
      .select({
        id: references.id,
        title: references.title,
        authors: references.authors,
        year: references.year,
        doi: references.doi,
        abstract: references.abstract,
      })
      .from(references)
      .orderBy(references.createdAt);

    return {
      success: true,
      references: allRefs,
    };
  } catch (error: any) {
    console.error("getLibraryReferencesAction Error:", error);
    return {
      success: false,
      error: error.message || "Referans listesi çekilemedi.",
    };
  }
}

/**
 * Server Action to save a specific brilliant academic insight into the Fikir Sepeti
 */
export async function saveInsightAction(
  insightText: string,
  noteId?: number,
): Promise<{
  success: boolean;
  insightId?: number;
  error?: string;
}> {
  try {
    if (!insightText || !insightText.trim()) {
      return { success: false, error: "Öngörü içeriği boş olamaz." };
    }

    const [newInsight] = await db
      .insert(aiInsights)
      .values({
        insightText: insightText.trim(),
        noteId: noteId || null,
      })
      .returning();

    return {
      success: true,
      insightId: newInsight.id,
    };
  } catch (error: any) {
    console.error("saveInsightAction Error:", error);
    return {
      success: false,
      error: error.message || "Öngörü kaydedilirken hata oluştu.",
    };
  }
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
  error?: string;
}> {
  try {
    if (!message || !message.trim()) {
      return { success: false, error: "Mesaj boş olamaz." };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        success: false,
        error:
          "Gemini API anahtarı bulunamadı (.env.local içindeki GEMINI_API_KEY).",
      };
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Step 1: Generate actual 1536-dimensional embedding of the user's message
    let embeddingVector: number[] = [];
    try {
      const embedResponse = await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: message.trim(),
        config: {
          outputDimensionality: 1536,
        },
      });
      embeddingVector = embedResponse.embeddings?.[0]?.values || [];
    } catch (embedErr: any) {
      console.error("Gemini Embedding Generation Error:", embedErr);
      return {
        success: false,
        error: `Aramada kullanılmak üzere embedding üretilemedi: ${embedErr.message}`,
      };
    }

    if (embeddingVector.length !== 1536) {
      return {
        success: false,
        error: "Geçerli 1536 boyutlu embedding vektörü alınamadı.",
      };
    }

    // Step 2: Drizzle ORM similarity search using cosine similarity
    let similarChunks: Array<{
      id: number;
      content: string;
      referenceId: number | null;
      similarity: number;
    }> = [];

    try {
      const targetEmbeddingStr = JSON.stringify(embeddingVector);
      const similaritySql = sql<number>`1 - (${pdfChunks.embedding} <=> ${targetEmbeddingStr}::vector)`;

      // Perform pgvector similarity search on pdf_chunks using cosine distance
      if (selectedReferenceIds && selectedReferenceIds.length > 0) {
        similarChunks = await db
          .select({
            id: pdfChunks.id,
            content: pdfChunks.content,
            referenceId: pdfChunks.referenceId,
            similarity: similaritySql,
          })
          .from(pdfChunks)
          .where(inArray(pdfChunks.referenceId, selectedReferenceIds))
          .orderBy(
            sql`${pdfChunks.embedding} <=> ${targetEmbeddingStr}::vector`,
          )
          .limit(5);
      } else {
        similarChunks = await db
          .select({
            id: pdfChunks.id,
            content: pdfChunks.content,
            referenceId: pdfChunks.referenceId,
            similarity: similaritySql,
          })
          .from(pdfChunks)
          .orderBy(
            sql`${pdfChunks.embedding} <=> ${targetEmbeddingStr}::vector`,
          )
          .limit(5);
      }
    } catch (dbErr: any) {
      console.error("Postgres/pgvector similarity query error:", dbErr);
      // We don't stop the process, we fall back to empty chunks
      similarChunks = [];
    }

    // Step 3: Filter chunks by a strict relevance threshold of 0.25
    // Map with a 1-based index (1 to 5) for citation referencing
    const relevantChunks = similarChunks
      .filter((chunk) => chunk.similarity >= 0.25)
      .map((chunk, idx) => ({
        ...chunk,
        index: idx + 1,
      }));

    // Get the reference titles for the sources return, including original text content
    let sourceReferenceInfos: CitationSource[] = [];
    if (relevantChunks.length > 0) {
      // Find all unique reference IDs
      const uniqueRefIds = Array.from(
        new Set(
          relevantChunks
            .map((c) => c.referenceId)
            .filter((id): id is number => id !== null),
        ),
      );

      if (uniqueRefIds.length > 0) {
        try {
          const refs = await db
            .select({ id: references.id, title: references.title })
            .from(references)
            .where(inArray(references.id, uniqueRefIds));

          const refTitleMap = new Map(refs.map((r) => [r.id, r.title]));

          sourceReferenceInfos = relevantChunks.map((c) => ({
            id: c.id,
            index: c.index,
            referenceId: c.referenceId,
            title: c.referenceId
              ? refTitleMap.get(c.referenceId) || "Bilinmeyen Döküman"
              : "Bilinmeyen Döküman",
            content: c.content,
            score: Number(c.similarity.toFixed(4)),
          }));
        } catch (refErr) {
          console.error("Failed to map reference titles for chunks:", refErr);
          sourceReferenceInfos = relevantChunks.map((c) => ({
            id: c.id,
            index: c.index,
            referenceId: c.referenceId,
            title: "Döküman Parçası",
            content: c.content,
            score: Number(c.similarity.toFixed(4)),
          }));
        }
      } else {
        sourceReferenceInfos = relevantChunks.map((c) => ({
          id: c.id,
          index: c.index,
          referenceId: c.referenceId,
          title: "Döküman Parçası",
          content: c.content,
          score: Number(c.similarity.toFixed(4)),
        }));
      }
    }

    // Step 4: Build XML Context Text from the relevant chunks using real database chunk IDs
    const contextText = relevantChunks
      .map((c) => `<chunk id="${c.id}">${c.content}</chunk>`)
      .join("\n\n");

    // Step 5: Construct System Instructions (Prompt) for hybrid reasoning, demanding database ID citations [^X]
    const systemInstruction =
      "Sen Fabricca projesinin Siyaset Bilimi ve Politik Sosyoloji alanında uzman, kıdemli, son derece bilge ve bilimsel metodolojiye hakim Tez Danışmanısın. Kullanıcı sana teziyle veya kütüphanesindeki kaynaklarla ilgili sorular sorduğunda:\n\n" +
      "1. Eğer soru kütüphanedeki dökümanlara veya kütüphane verilerine yönelikse, sana iletilen BAĞLAM (Context) dışına çıkmadan, verileri tahrif etmeden, uydurma yapmadan net, atıflı ve dökümana sadık yanıt ver.\n" +
      "2. Eğer kullanıcı sana genel metodolojik kurallar (Nitel/nicel analiz yöntemleri, vaka seçimi, karşılaştırma modelleri vb.), sosyal teoriler (Marx, Foucault, biopolitika, finansallaşma, Gramsci, hegemonya kavramları), akademik akademik yazım teknikleri veya tez kurgusu gibi kuramsal/yöntemsel sorular soruyorsa, RAG bağlamıyla sınırlı kalma! Kendi derin akademik hafızanı, geniş entelektüel birikimini ve uzmanlığını devreye sokarak kullanıcıya son derece yaratıcı, kapsamlı ve yol gösterici entelektüel rehberlik sağla.\n\n" +
      'UYARI: Sana verilen bağlam içindeki her bir akademik metin parçası <chunk id="X"> etiketiyle sarılmıştır. Cevap üretirken bağlamdan aldığın her bilginin, cümlenin veya dönemin hemen sonuna istisnasız bir şekilde tam olarak [^X] formatında atıf ekleyeceksin (Buradaki X, dökümanın gerçek id numarası olmalıdır). Kendi hafından [1], [^1] veya (1) gibi statik atıflar KESİNLİKLE üretmeyeceksin.\n\n' +
      "Yanıtlarını her zaman son derece saygın, teşvik edici, yapıcı bir akademik üslupla (örneğin 'Sevgili meslektaşım', 'Tez çalışmanda bu nokta önemli' vb.) ve temiz Markdown formatında sun. Başlıklar, listeler ve vurgulamalar kullanarak okunabilirliği maksimize et.";

    // Step 6: Format Gemini API payload (contents array)
    const contents = [
      ...chatHistory.map((item) => ({
        role: item.role === "assistant" ? "model" : item.role,
        parts: [{ text: item.content }],
      })),
      {
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
      },
    ];

    // Step 7: Call Google Gemini 3.1 Flash Lite via official SDK
    const genAIResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: contents as any,
      config: {
        systemInstruction: systemInstruction,
        temperature: 1, // Lower temperature for high academic precision and adherence to instructions
      },
    });

    const responseText = genAIResponse.text;
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
  } catch (error: any) {
    console.error("sendMessageAction Error:", error);
    return {
      success: false,
      error:
        error.message ||
        "Mesaj işlenirken yapay zeka servisinde bir hata oluştu.",
    };
  }
}
