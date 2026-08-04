"use server";

import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { chatSessions, chatMessages, type ChatMessage } from "@/db/schema";
import { getSession } from "@/lib/session";
import type { RagSearchResultItem } from "@/lib/services/rag-search";

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
