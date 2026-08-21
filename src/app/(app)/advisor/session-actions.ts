"use server";

import { and, eq, desc } from "drizzle-orm";
import { db } from "@/core/db";
import { sessions, messages } from "@/core/db/schema";
import { getSession } from "@/lib/session";
import { handleActionError } from "@/lib/errors/handle-error";

export interface ChatSessionListItem {
  id: number;
  title: string;
  createdAt: string;
  messageCount: number;
}

export type ChatSessionsResult =
  | { success: true; data: ChatSessionListItem[] }
  | { success: false; error: string; code: string };

/**
 * Lists all chat sessions for the current user ordered by most recent.
 *
 * @returns The session list on success, or the normalized error result on failure.
 */
export async function getChatSessions(): Promise<ChatSessionsResult> {
  try {
    const session = await getSession();
    if (!session) return { success: true, data: [] };

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
    return { success: true, data: result };
  } catch (err) {
    return handleActionError(err);
  }
}

/**
 * Creates a new empty chat session for the current user.
 *
 * @param title - The display title for the new session.
 * @returns The newly created session id, or the normalized error result.
 */
export async function createChatSession(
  title: string,
): Promise<{ success: boolean; sessionId?: number; error?: string }> {
  try {
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
  } catch (err) {
    return handleActionError(err);
  }
}

/**
 * Renames an existing chat session.
 *
 * @param sessionId - The session to rename.
 * @param title - The new title.
 * @returns Operation result or the normalized error result.
 */
export async function renameChatSession(
  sessionId: number,
  title: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum süreniz dolmuş." };

    const trimmed = title.trim().slice(0, 100);
    if (!trimmed) return { success: false, error: "Başlık boş olamaz." };

    // IDOR check: session must belong to the authenticated user
    const [owned] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)),
      );
    if (!owned) return { success: false, error: "Oturum bulunamadı." };

    await db
      .update(sessions)
      .set({ title: trimmed, updatedAt: new Date() })
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)),
      );

    return { success: true };
  } catch (err) {
    return handleActionError(err);
  }
}

/**
 * Deletes a chat session and all its messages.
 *
 * @param sessionId - The session to delete.
 * @returns Operation result or the normalized error result.
 */
export async function deleteChatSession(
  sessionId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum süreniz dolmuş." };

    const [owned] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)),
      );
    if (!owned) return { success: false, error: "Oturum bulunamadı." };

    await db
      .delete(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)),
      );
    return { success: true };
  } catch (err) {
    return handleActionError(err);
  }
}
