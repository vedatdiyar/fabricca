"use server";

import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { chatSessions, chatMessages, type ChatMessage } from "@/db/schema";
import { getSession } from "@/lib/session";
import { performHybridRagSearch } from "@/lib/services/rag-search";
import type { RagSearchResultItem } from "@/lib/services/rag-search";
import { getAi } from "@/lib/services/gemini";
import { FLASH_LITE_31 } from "@/lib/constants";
import { Logger, createFlowId } from "@/lib/logger";

const querySchema = z.object({
  query: z
    .string()
    .min(2, "Sorgu en az 2 karakter olmalıdır.")
    .max(1000, "Sorgu çok uzun."),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        content: z.string(),
      }),
    )
    .optional(),
});

export interface AdvisorResponse {
  success: boolean;
  answer?: string;
  sources?: RagSearchResultItem[];
  error?: string;
}

/**
 * Formats a retrieval source page reference using Turkish academic APA conventions.
 *
 * @param source - The RAG retrieval result whose page span should be rendered.
 * @returns The page reference string ("Bilinmeyen Sayfa" when no page info exists).
 */
function formatPageReference(source: RagSearchResultItem): string {
  if (source.printedPageNumber) return `${source.printedPageNumber}.`;
  const pageSpan = source.pageStart;
  const range = source.pageEnd;
  if (pageSpan == null) return "Bilinmeyen Sayfa";
  return pageSpan === range ? `s. ${pageSpan}.` : `ss. ${pageSpan}–${range}.`;
}

/**
 * Server Action executing hybrid RAG retrieval and generating an academic response using Gemini Flash-Lite.
 *
 * @param input - The search query and conversation history container.
 * @param input.query - The search query string.
 * @param input.history - Optional previous message history.
 * @returns The generated response text and cited RAG sources.
 */
export async function sendAdvisorQueryAction(input: {
  query: string;
  history?: { role: "user" | "model"; content: string }[];
}): Promise<AdvisorResponse> {
  const parseResult = querySchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || "Geçersiz sorgu.",
    };
  }

  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.",
    };
  }

  const flowId = createFlowId();
  const log = new Logger(flowId);

  try {
    log.info("advisor_rag_search_start", {
      service: "advisor",
      data: { query: parseResult.data.query },
    });

    const sources = await performHybridRagSearch({
      query: parseResult.data.query,
      topK: 5,
      logger: log,
    });

    log.info("advisor_rag_search_success", {
      service: "advisor",
      data: { sourceCount: sources.length },
    });

    let contextText = "";
    if (sources.length > 0) {
      contextText = sources
        .map((s, idx) => {
          const pageStr = formatPageReference(s);
          const secStr = s.sectionTitle ? ` | Bölüm: ${s.sectionTitle}` : "";
          const authors = s.resourceAuthors.join(", ");
          return `--- KAYNAK PARÇASI #${idx + 1} ---
[Eser: "${s.resourceTitle}" | Yazar: ${authors} | ${pageStr}${secStr} | Alakalılık Skoru: ${(s.relevanceScore * 100).toFixed(1)}%]
${s.content}`;
        })
        .join("\n\n");
    } else {
      contextText =
        "Kütüphanedeki dökümanlarda bu sorguyla doğrudan eşleşen metin bulunamadı.";
    }

    const systemInstruction = `Sen dijital tez asistanı uygulamasının elit Yapay Zeka Tez Danışmanısın (Lead Academic Advisor).
Görevin: Yüksek lisans ve doktora öğrencilerinin akademik sorularına titiz, tarafsız, analitik ve elit bir akademik Türkçe ile yanıt vermektir.

Sana verilen Kütüphane RAG Bağlamı (Top 5 En Alakalı Makale Bölümü):
${contextText}

TALİMATLAR VE KURALLAR:
1. Yalnızca kütüphaneden çekilen yukarıdaki RAG bağlamındaki bilgilere ve bulgulara dayanarak akademik yanıt üret.
2. Bağlamda yeterli veya doğrudan bilgi yoksa bunu dürüstçe ve açıkça ifade et.
3. Metin içerisinde bilgi aktarırken mutlaka [Eser Adı, s. X] veya çok sayfalı aktarımlarda [Eser Adı, ss. X–Y] formatında atıfta bulun.
4. Yanıtını net başlıklar, maddeler ve akıcı paragraflarla yapılandır.
5. Kullanıcının sorusuna doğrudan, özgüvenli ve bilimsel metodolojiye uygun cevap ver.`;

    const ai = getAi();
    const contents: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    if (parseResult.data.history && parseResult.data.history.length > 0) {
      for (const msg of parseResult.data.history.slice(-6)) {
        contents.push({
          role: msg.role,
          parts: [{ text: msg.content }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: parseResult.data.query }],
    });

    log.info("advisor_llm_generate_start", {
      service: "advisor",
      data: { model: FLASH_LITE_31 },
    });

    const response = await ai.models.generateContent({
      model: FLASH_LITE_31,
      contents,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const answer = response.text || "Danışman yanıtı üretilemedi.";

    log.info("advisor_llm_generate_success", {
      service: "advisor",
      data: { answerLength: answer.length },
    });

    return {
      success: true,
      answer,
      sources,
    };
  } catch (error) {
    log.error("advisor_query_failed", {
      service: "advisor",
      error,
    });

    return {
      success: false,
      error:
        "Danışman yanıtı üretilirken bir hata oluştu. Lütfen tekrar deneyin.",
    };
  }
}

export interface ChatSessionListItem {
  id: number;
  title: string;
  createdAt: string;
  messageCount: number;
}

/**
 * Lists all chat sessions for the current user ordered by most recent.
 *
 * @returns The list of chat sessions with message counts.
 */
export async function getChatSessions(): Promise<ChatSessionListItem[]> {
  const session = await getSession();
  if (!session) return [];

  const rows = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      createdAt: chatSessions.createdAt,
    })
    .from(chatSessions)
    .where(eq(chatSessions.userId, session.userId))
    .orderBy(desc(chatSessions.updatedAt));

  const sessions: ChatSessionListItem[] = [];
  for (const row of rows) {
    const msgs = await db
      .select({ count: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, row.id));
    sessions.push({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toLocaleDateString("tr-TR"),
      messageCount: msgs.length,
    });
  }
  return sessions;
}

/**
 * Creates a new empty chat session for the current user.
 *
 * @param title - The display title for the new session.
 * @returns The newly created session id.
 */
export async function createChatSession(
  title: string,
): Promise<{ success: boolean; sessionId?: number; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Oturum süreniz dolmuş." };
  }

  const trimmed = title.trim().slice(0, 100) || "Yeni Sohbet";
  const [inserted] = await db
    .insert(chatSessions)
    .values({ userId: session.userId, title: trimmed })
    .returning({ id: chatSessions.id });

  return { success: true, sessionId: inserted.id };
}

/**
 * Renames an existing chat session.
 *
 * @param sessionId - The session to rename.
 * @param title - The new title.
 * @returns Operation result.
 */
export async function renameChatSession(
  sessionId: number,
  title: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Oturum süreniz dolmuş." };

  const trimmed = title.trim().slice(0, 100);
  if (!trimmed) return { success: false, error: "Başlık boş olamaz." };

  await db
    .update(chatSessions)
    .set({ title: trimmed, updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));

  return { success: true };
}

/**
 * Deletes a chat session and all its messages.
 *
 * @param sessionId - The session to delete.
 * @returns Operation result.
 */
export async function deleteChatSession(
  sessionId: number,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Oturum süreniz dolmuş." };

  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
  return { success: true };
}

/**
 * Retrieves all messages for a given chat session.
 *
 * @param sessionId - The session whose messages to load.
 * @returns The messages in chronological order.
 */
export async function getChatMessages(
  sessionId: number,
): Promise<{ success: boolean; messages?: ChatMessage[]; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Oturum süreniz dolmuş." };
  }

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);

  return { success: true, messages: rows };
}

/**
 * Saves a single message to a chat session and touches the session timestamp.
 *
 * @param sessionId - The session to save to.
 * @param role - Message role (user or model).
 * @param content - The message content.
 * @param sources - Optional RAG sources for model messages.
 * @returns Operation result.
 */
export async function saveChatMessage(
  sessionId: number,
  role: "user" | "model",
  content: string,
  sources?: RagSearchResultItem[],
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Oturum süreniz dolmuş." };

  await db.insert(chatMessages).values({
    sessionId,
    role,
    content,
    sources: sources ?? undefined,
  });

  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));

  return { success: true };
}
