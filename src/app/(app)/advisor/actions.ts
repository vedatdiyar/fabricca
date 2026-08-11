"use server";

import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  sessions,
  messages,
  type Message,
  type ChatToolCall,
} from "@/db/schema";
import { getSession } from "@/lib/session";
import type { RagSearchResultItem } from "@/lib/services/rag-search";
import type { PipelineResultData } from "@/db/schema";
import { generateStructuredContent } from "@/lib/services/cerebras";
import { CEREBRAS_MODEL } from "@/lib/constants";

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
      id: sessions.id,
      title: sessions.title,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, session.userId))
    .orderBy(desc(sessions.updatedAt));

  const result: ChatSessionListItem[] = [];
  for (const row of rows) {
    const msgs = await db
      .select({ count: messages.id })
      .from(messages)
      .where(eq(messages.sessionId, row.id));
    result.push({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toLocaleDateString("tr-TR"),
      messageCount: msgs.length,
    });
  }
  return result;
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
    .insert(sessions)
    .values({ userId: session.userId, title: trimmed })
    .returning({ id: sessions.id });

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
    .update(sessions)
    .set({ title: trimmed, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));

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

  await db.delete(sessions).where(eq(sessions.id, sessionId));
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
): Promise<{ success: boolean; messages?: Message[]; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Oturum süreniz dolmuş." };
  }

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt);

  return { success: true, messages: rows };
}

/**
 * Saves a single message to a chat session and touches the session timestamp.
 *
 * @param sessionId - The session to save to.
 * @param role - Message role (user or model).
 * @param content - The message content.
 * @param sources - Optional RAG sources for model messages.
 * @param toolCalls - Optional stored tool calls.
 * @param persona - Optional persona badge for model messages.
 * @param pipelineData - Optional structured pipeline result for model messages.
 * @returns Operation result with created message ID.
 */
export async function saveChatMessage(
  sessionId: number,
  role: "user" | "model",
  content: string,
  sources?: RagSearchResultItem[],
  toolCalls?: ChatToolCall[],
  persona?: string,
  pipelineData?: PipelineResultData | null,
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Oturum süreniz dolmuş." };

  const [inserted] = await db
    .insert(messages)
    .values({
      sessionId,
      role,
      persona: persona ?? undefined,
      content,
      sources: sources ?? undefined,
      toolCalls: toolCalls ?? undefined,
      pipelineData: pipelineData ?? undefined,
    })
    .returning({ id: messages.id });

  await db
    .update(sessions)
    .set({ updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));

  return { success: true, messageId: inserted.id };
}

/**
 * Updates the tool calls approval/rejection status for a stored chat message.
 *
 * @param messageId - The chat message ID to update.
 * @param toolCalls - The updated list of tool calls with new statuses.
 * @returns Operation result.
 */
export async function updateChatMessageToolCalls(
  messageId: number,
  toolCalls: ChatToolCall[],
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Oturum süreniz dolmuş." };

  await db
    .update(messages)
    .set({ toolCalls })
    .where(eq(messages.id, messageId));

  return { success: true };
}

const titleZodSchema = z.object({
  title: z
    .string()
    .describe(
      "3 ila 5 kelimelik, net, öz ve Türkçe bir akademik sohbet başlığı.",
    ),
});

const titleJsonSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "3 ila 5 kelimelik, net, öz ve Türkçe bir akademik sohbet başlığı.",
    },
  },
  required: ["title"],
  additionalProperties: false,
};

/**
 * Generates a concise 3-5 word academic topic title using Cerebras Gemma 4 (gemma-4-31b)
 * and updates the chat session title in the database.
 *
 * @param sessionId - The chat session ID to update.
 * @param userQuery - The first user prompt query.
 * @returns Operation result with generated title.
 */
export async function generateChatTitleAction(
  sessionId: number,
  userQuery: string,
): Promise<{ success: boolean; title?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Oturum süreniz dolmuş." };

  try {
    const systemInstruction =
      "Sen bir akademik tez asistanısın. Kullanıcının sorduğu soruyu analiz ederek bu sohbet için 3 ila 5 kelimelik, net, öz ve Türkçe bir konu başlığı çıkar. Başlıkta soru eki, tırnak işareti veya ek açıklama yazma. Örnekler: 'David Romano Etnisite Yaklaşımı', 'Primordiyalist Kuram Analizi', 'Söylem Analizi Metodolojisi'.";
    const prompt = `Kullanıcı Sorusu: ${userQuery}`;

    const res = await generateStructuredContent<{ title: string }>(
      CEREBRAS_MODEL,
      systemInstruction,
      prompt,
      titleJsonSchema,
      undefined,
      {
        zodSchema: titleZodSchema,
        payloadStage: "advisor_chat_title",
      },
    );

    const title = res.title?.trim().slice(0, 100);
    if (title) {
      await renameChatSession(sessionId, title);
      return { success: true, title };
    }
    return { success: false, error: "Başlık üretilemedi." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Başlık üretilemedi.",
    };
  }
}
