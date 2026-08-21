"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/core/db";
import {
  sessions,
  messages,
  type Message,
  type ChatToolCall,
} from "@/core/db/schema";
import { getSession } from "@/lib/session";
import type { RagSearchResultItem } from "@/core/services/search/rag-search";
import type { PipelineResultData } from "@/core/db/schema";
import { handleActionError } from "@/lib/errors/handle-error";

/**
 * Retrieves all messages for a given chat session.
 *
 * @param sessionId - The session whose messages to load.
 * @returns The messages or the normalized error result.
 */
export async function getChatMessages(
  sessionId: number,
): Promise<{ success: boolean; messages?: Message[]; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Oturum süreniz dolmuş." };
    }

    // Ownership check: session must belong to the authenticated user
    const [owned] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)),
      );
    if (!owned) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.createdAt);

    return { success: true, messages: rows };
  } catch (err) {
    return handleActionError(err);
  }
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
 * @returns Operation result with created message ID or the normalized error result.
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
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum süreniz dolmuş." };

    // Ownership check: session must belong to the authenticated user
    const [owned] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)),
      );
    if (!owned) {
      return { success: false, error: "Oturum bulunamadı." };
    }

    const messageId = await db.transaction(async (tx) => {
      const [inserted] = await tx
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

      await tx
        .update(sessions)
        .set({ updatedAt: new Date() })
        .where(
          and(eq(sessions.id, sessionId), eq(sessions.userId, session.userId)),
        );

      return inserted.id;
    });

    return { success: true, messageId };
  } catch (err) {
    return handleActionError(err);
  }
}

/**
 * Updates the tool calls approval/rejection status for a stored chat message.
 *
 * @param messageId - The chat message ID to update.
 * @param toolCalls - The updated list of tool calls with new statuses.
 * @returns Operation result or the normalized error result.
 */
export async function updateChatMessageToolCalls(
  messageId: number,
  toolCalls: ChatToolCall[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Oturum süreniz dolmuş." };

    // Ownership check: message's session must belong to the authenticated user
    const [owned] = await db
      .select({ id: messages.id })
      .from(messages)
      .innerJoin(sessions, eq(messages.sessionId, sessions.id))
      .where(
        and(eq(messages.id, messageId), eq(sessions.userId, session.userId)),
      );
    if (!owned) {
      return { success: false, error: "Mesaj bulunamadı." };
    }

    await db
      .update(messages)
      .set({ toolCalls })
      .where(eq(messages.id, messageId));

    return { success: true };
  } catch (err) {
    return handleActionError(err);
  }
}
