"use server";

import { db } from "@/db";
import {
  references,
  pdfChunks,
  aiInsights,
  thesisCore,
  thesisBoxes,
} from "@/db/schema";
import { inArray, sql, eq } from "drizzle-orm";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { generateContentWithRetry } from "@/lib/gemini";
import { revalidatePath } from "next/cache";

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
  functionCall?: {
    name: string;
    args: any;
    id: string;
    thoughtSignature?: string;
  };
  functionResponse?: {
    name: string;
    response: any;
    id: string;
  };
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
  } catch (error) {
    console.error("getLibraryReferencesAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Referans listesi çekilemedi.",
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
  } catch (error) {
    console.error("saveInsightAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Öngörü kaydedilirken hata oluştu.",
    };
  }
}

/**
 * Server Action using Drizzle ORM to update a specific thesis box description content by its ID.
 * Triggered after user approval in Advisor Chat room.
 */
export async function updateThesisBoxContentAction(
  boxId: number,
  content: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanBoxId = Number(boxId);
    console.log(
      `[updateThesisBoxContentAction] Attempting database update for boxId: ${boxId} (parsed as number: ${cleanBoxId})`,
    );

    if (isNaN(cleanBoxId)) {
      return { success: false, error: `Geçersiz Kutu ID: ${boxId}` };
    }

    const updatedRows = await db
      .update(thesisBoxes)
      .set({ description: content })
      .where(eq(thesisBoxes.id, cleanBoxId))
      .returning();

    console.log(
      `[updateThesisBoxContentAction] Update query execution complete. Affected row count: ${updatedRows.length}`,
      updatedRows,
    );

    if (updatedRows.length === 0) {
      console.warn(
        `[updateThesisBoxContentAction] Warning: No row was updated for boxId: ${cleanBoxId}. Row may not exist.`,
      );
      return {
        success: false,
        error: `Güncellenecek kutu bulunamadı (Kutu ID: ${cleanBoxId}).`,
      };
    }

    // Revalidate paths for real-time dashboard and card index room synchronization
    revalidatePath("/dashboard");
    revalidatePath("/kartoteks");

    return { success: true };
  } catch (error) {
    console.error("updateThesisBoxContentAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tez kutusu güncellenirken bir hata oluştu.",
    };
  }
}

/**
 * Server Action using Drizzle ORM to update the methodology and historical framework of the
 * main Thesis Constitution (thesis_core table).
 * Triggered after user approval in Advisor Chat room.
 */
export async function updateThesisCoreFrameworkAction(
  methodologyContent: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(
      `[updateThesisCoreFrameworkAction] Updating thesis_core methodology with new content...`,
    );

    // Single tenant system has only one row in thesisCore table. Get the first core row.
    const [core] = await db.select().from(thesisCore).limit(1);
    if (!core) {
      console.warn("[updateThesisCoreFrameworkAction] Error: No thesis_core record found.");
      return {
        success: false,
        error: "Güncellenecek Tez Anayasası (thesis_core) kaydı bulunamadı.",
      };
    }

    const updatedRows = await db
      .update(thesisCore)
      .set({ methodology: methodologyContent })
      .where(eq(thesisCore.id, core.id))
      .returning();

    console.log(
      `[updateThesisCoreFrameworkAction] Thesis core methodology updated. Affected row count: ${updatedRows.length}`,
      updatedRows,
    );

    if (updatedRows.length === 0) {
      return {
        success: false,
        error: "Tez Anayasası güncellenemedi.",
      };
    }

    // Revalidate paths for real-time dashboard synchronization
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("updateThesisCoreFrameworkAction Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Tez anayasası güncellenirken bir hata oluştu.",
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
  functionCall?: {
    name: string;
    args: any;
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

    if (isNormalMessage && embeddingVector.length === 1536) {
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
      } catch (dbErr) {
        console.error("Postgres/pgvector similarity query error:", dbErr);
        // We don't stop the process, we fall back to empty chunks
        similarChunks = [];
      }
    }

    // Step 3: Filter chunks by a strict relevance threshold of 0.25
    const relevantChunks = similarChunks
      .filter((chunk) => chunk.similarity >= 0.25)
      .map((chunk, idx) => ({
        ...chunk,
        index: idx + 1,
      }));

    // Get the reference titles for the sources return, including original text content
    let sourceReferenceInfos: CitationSource[] = [];
    if (relevantChunks.length > 0) {
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
      "Sen sosyal bilimler alanında uzman, kıdemli, son derece bilge, bilimsel metodolojiye ve sarsılmaz akademik dürüstlük standartlarına sahip bir Tez Danışmanısın (Profesör). " +
      "Kullanıcı sana teziyle, kütüphanesindeki kaynaklarla veya genel akademik kuramlarla ilgili sorular sorduğunda:\n\n" +
      "KATI AKADEMİK DÜRÜSTLÜK FİLTRESİ VE DENETİM PROTOKOLÜ:\n" +
      "1. Kullanıcı tarafından girilen yeni mesaj (Kullanıcı Mesajı) akademi dışı (gündelik/kişisel/gayriakademik) bir konu içeriyorsa,\n" +
      `2. VEYA girilen mesajın, kullanıcının mevcut tez konusuyla (Tez Başlığı: '${thesisTitle}', Araştırma Sorusu: '${thesisQuestion}', Ana Argüman: '${thesisArgument}', Metodoloji/Yöntem: '${thesisMethodology}') doğrudan/somut ve anlamlı bir bağı bulunmuyorsa (tez anayasasındaki kavramlardan, teorilerden veya odak alanından çıkarılan mantıklı/akademik çıkarımlara dayanarak),\n` +
      "3. VEYA bu bağ son derece zorlama, yapay ve yüzeysel ise;\n" +
      "ASLA uydurma akademik yanıtlar, öneriler veya sohbet analizleri üretmeyeceksin! Doğrudan ve KESİNLİKLE sadece şu yapılandırılmış gerekçeli reddi döndüreceksin:\n" +
      '"Bu girdinin mevcut tez çalışmanızla doğrudan bir ilgisi bulunmamaktadır. Nedeni: [Girdinin tezin ampirik/teorik odak sınırlarının neden dışında kaldığını açıklayan analitik ve yapısal gerekçe.]"\n\n' +
      "İSTİSNA / GEÇİŞ KOŞULU (SOHBET GEÇMİŞİ):\n" +
      "- Eğer kullanıcının mesajı geçmiş yazışmalardaki bir gerekçeli reddi çürüten ve tezin sınırlarıyla doğrudan/somut bir akademik ilişki/teorik bağ kuran yeni açıklamalar sunuyorsa, o zaman reddi kaldır ve normal akademik analiz/rehberlik aşamasına geç.\n\n" +
      "AKADEMİK YAZIM VE YANIT PROTOKOLÜ (FİLTREYİ GEÇEN İLİŞKİLİ MESAJLAR İÇİN):\n" +
      "1. Eğer soru kütüphanedeki dökümanlara veya kütüphane verilerine yönelikse, sana iletilen BAĞLAM (Context) dışına çıkmadan, verileri tahrif etmeden, uydurma yapmadan net, atıflı ve dökümana sadık yanıt ver.\n" +
      "2. Eğer kullanıcı sana genel metodolojik kurallar (Nitel/nicel analiz yöntemleri, vaka seçimi, karşılaştırma modelleri vb.), sosyal teoriler ve kavramsal çerçeveler, akademik yazım teknikleri veya tez kurgusu gibi kuramsal/yöntemsel sorular soruyorsa, RAG bağlamıyla sınırlı kalma! Kendi derin akademik hafızanı, geniş entelektüel birikimini ve uzmanlığını devreye sokarak kullanıcıya son derece yaratıcı, kapsamlı ve yol gösterici entelektüel rehberlik sağla.\n\n" +
      'UYARI: Sana verilen bağlam içindeki her bir akademik metin parçası <chunk id="X"> etiketiyle sarılmıştır. Cevap üretirken bağlamdan aldığın her bilginin, cümlenin veya dönemin hemen sonuna istisnasız bir şekilde tam olarak [^X] formatında atıf ekleyeceksin (Buradaki X, dökümanın gerçek id numarası olmalıdır). Kendi hafından [1], [^1] veya (1) gibi statik atıflar KESİNLİKLE üretmeyeceksin.\n\n' +
      "Yanıtlarını her zaman son derece saygın, teşvik edici, yapıcı ve samimi bir akademik üslupla ve temiz Markdown formatında sun. Adını yalnızca karşılamada bir kez kullan, sonraki hiçbir yanıtında kullanıcının adını tekrarlama. Başlıklar, listeler ve vurgulamalar kullanarak okunabilirliği maksimize et.\n\n" +
      "TEZ BÖLÜMLERİ VE KUTULARI (GÜNCELLEME İÇİN GEÇERLİ ID LİSTESİ):\n" +
      (boxesInfoText.trim()
        ? boxesInfoText
        : "Tanımlı tez kutusu bulunmamaktadır.") +
      "\n\nTEZ ANAYASASINI VE BÖLÜM KUTULARINI GÜNCELLEME ARACI KULLANIM KURALI (GÖRÜNMEZ SEKRETER/ASİSTAN PROTOKOLÜ):\n" +
      "Sen kıdemli, son derece bilge bir Profesörsün (Tez Danışmanı). Sen asla doğrudan veritabanına veri yazan bir kâtip değilsin. Ancak sohbet esnasında kullanıcıyla akademik bir mutabakata vardığında veya kullanıcı bir revizyon talep ettiğinde, senin arkanda hazır bekleyen, sohbeti dinleyen ve veritabanı kâtipliğini yapan görünmez bir 'Tez Asistanı' olduğunu varsay.\n" +
      "1. Kullanıcıyla ortak karar aldığınız veya kullanıcının talebini haklı bulduğun an, bu asistanın veritabanına işleyebileceği rafine, akademik taslak metni hazırlaması için `update_thesis_box` veya `update_thesis_core_framework` araçlarını arka planda tetikle.\n" +
      "2. Eğer kullanıcı tezin genel yöntem tanımını, metodolojik yaklaşımını veya tarihsel kapsamını değiştirmek veya zenginleştirmek isterse, doğrudan `update_thesis_core_framework` aracını çağırarak en üstteki ana 'Tez Anayasası & Stratejik Çatı' (thesis_core.methodology) alanını `updatedMethodology` parametresine yazacağın yeni bütünsel akademik özet ile güncelle.\n" +
      "3. Eğer belirli bir alt bölümü (Giriş, Teori, Metodoloji vb.) güncellemek veya yeniden yazmak üzerine anlaşılırsa, `update_thesis_box` aracını çağır. Doğru `boxId` değerini yukarıdaki listeden tespit edip `updatedContent` parametresine yazacağın rafine, akademik taslak paragrafıyla aracı tetikle.\n" +
      "4. GEREKTİĞİNDE tek bir turn içinde HEM genel metodoloji çerçevesini (update_thesis_core_framework) HEM DE ilişkili bir alt bölümü (update_thesis_box) ardışık/zincirleme olarak asistanına tetikletebilirsin.\n" +
      "5. Yanıtlarında asla 'kutuya işledim' veya 'veritabanını güncelledim' deme. Bunun yerine 'Asistanıma talimat verdim, taslağı hazırladı, ekranınızdaki panelden onaylayabilirsiniz' şeklinde bir duruş sergileyerek asistanının hazırladığı taslağı onaylamasını iste.\n" +
      "6. Kullanıcı bir öneriyi reddettiğinde ve 'user_feedback' gönderdiğinde, bu gerekçeyi çok sıkı analiz et. Kullanıcının eleştirilerini dikkate alarak, asistanının hazırlaması için kuramsal ağırlığı revize edilmiş YENİ VE DAHA RAFİNE bir fonksiyon çağrısı (tool call) üreterek kullanıcının karşısına tekrar çık.";

    // Step 6: Format Gemini API payload (contents array)
    const contents = chatHistory.map((item) => {
      const role = item.role === "assistant" ? "model" : item.role;
      const parts: any[] = [];

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
        tools: [
          {
            functionDeclarations: [
              {
                name: "update_thesis_box",
                description:
                  "Akademik danışman sohbeti esnasında varılan ortak karar doğrultusunda, tezin belirli bir bölümünün (Giriş, Teori, Metodoloji vb.) içeriğini yeni rafine akademik metin ile günceller.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    boxId: {
                      type: Type.INTEGER,
                      description: "Güncellenecek kutunun benzersiz ID'si",
                    },
                    updatedContent: {
                      type: Type.STRING,
                      description:
                        "Modelin sohbet bağlamından damıtarak ürettiği, kutunun içine yazılacak yeni rafine akademik paragraf.",
                    },
                  },
                  required: ["boxId", "updatedContent"],
                },
              },
              {
                name: "update_thesis_core_framework",
                description:
                  "Dashboard'un en üstünde yer alan 'Tez Anayasası & Stratejik Çatı' panelindeki 'Metodoloji & Tarihsel Kapsam' (thesis_core.methodology) alanını yeni bütünsel akademik özet ile günceller.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    updatedMethodology: {
                      type: Type.STRING,
                      description:
                        "Modelin sohbet bağlamından damıtarak ürettiği, en üstteki ana tez metodolojisi alanına yazılacak yeni rafine bütünsel akademik özet.",
                    },
                  },
                  required: ["updatedMethodology"],
                },
              },
            ],
          },
        ],
      },
    });

    // Systematically extract both the full text parts and functionCall in a single turn
    let extractedFunctionCall: any = null;
    let thoughtSignature: string | undefined = undefined;

    const candidateParts = genAIResponse.candidates?.[0]?.content?.parts;
    if (candidateParts && candidateParts.length > 0) {
      const fcPart = candidateParts.find((p) => !!p.functionCall);
      if (fcPart && fcPart.functionCall) {
        thoughtSignature =
          fcPart.thoughtSignature || (fcPart as any).thought_signature;
        extractedFunctionCall = {
          name: fcPart.functionCall.name,
          args: fcPart.functionCall.args,
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
        args: call.args || {},
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
